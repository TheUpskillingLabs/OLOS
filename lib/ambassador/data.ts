/* Server-side reads and writes for the Ambassador role (00104). Every caller
   uses the service-role client and does its own authorization first: member
   routes act on the caller's own participant row; coordinator routes check
   the Lab scope with requireLabAccess (lib/auth/lab.ts) — admin, or a lead of
   the application's Lab. HQ rows (lab_id NULL) are admin-only. */

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, type UserRoles } from "@/lib/auth/roles";
import type { AmbassadorApplication } from "./status";
import {
  activeReviews,
  awaitsReviewer,
  reviewOutcome,
  REVIEW_SELECT,
  type AmbassadorReview,
  type ReviewDecision,
} from "./review";

type Service = SupabaseClient;

export const APPLICATION_SELECT =
  "id, participant_id, lab_id, status, oriented_at, quiz_version, quiz_score, quiz_total, quiz_passed_at, agreement_version, agreement_accepted_at, referred_by, referred_by_participant_id, invite_id, submitted_at, decided_at, decided_by, decision_note, ready_at, button_given_at, button_given_by, created_at, updated_at";

export interface AmbassadorSelf {
  participant: {
    id: number;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string;
    zip: string | null;
    handle: string | null;
    metro_id: number | null;
  };
  application: AmbassadorApplication | null;
  /** The active ambassador grant, if any (its Lab scope). */
  role: { lab_id: number | null; granted_at: string } | null;
  stepsDone: string[];
}

export async function getAmbassadorSelf(service: Service, participantId: number): Promise<AmbassadorSelf | null> {
  const [{ data: participant }, { data: application }, { data: roles }, { data: steps }] = await Promise.all([
    service
      .from("participants")
      .select("id, first_name, last_name, preferred_name, email, zip, handle, metro_id")
      .eq("id", participantId)
      .maybeSingle(),
    service.from("ambassador_applications").select(APPLICATION_SELECT).eq("participant_id", participantId).maybeSingle(),
    service
      .from("participant_roles")
      .select("lab_id, granted_at")
      .eq("participant_id", participantId)
      .eq("role", "ambassador")
      .is("revoked_at", null)
      .order("granted_at", { ascending: true })
      .limit(1),
    service.from("ambassador_step_progress").select("step_id").eq("participant_id", participantId),
  ]);
  if (!participant) return null;
  return {
    participant: participant as AmbassadorSelf["participant"],
    application: (application as AmbassadorApplication | null) ?? null,
    role: roles?.[0] ?? null,
    stepsDone: (steps ?? []).map((s: { step_id: string }) => s.step_id),
  };
}

/** May see the coordinator surface at all: an admin or any Lab's lead. */
export function isCoordinator(user: UserRoles): boolean {
  return isAdmin(user) || user.labLeadLabIds.length > 0;
}

/** The Labs a coordinator's lists cover: null = every Lab and HQ (admin). */
export function coordinatorLabs(user: UserRoles): number[] | null {
  return isAdmin(user) ? null : user.labLeadLabIds;
}

/** Grant the role. Idempotent: an existing active grant is left as is. */
export async function grantAmbassadorRole(
  service: Service,
  participantId: number,
  labId: number | null,
  grantedBy: number | null,
  note: string
): Promise<{ error: unknown }> {
  const { data: existing } = await service
    .from("participant_roles")
    .select("id")
    .eq("participant_id", participantId)
    .eq("role", "ambassador")
    .is("revoked_at", null)
    .limit(1);
  if (existing && existing.length > 0) return { error: null };
  const { error } = await service.from("participant_roles").insert({
    participant_id: participantId,
    role: "ambassador",
    lab_id: labId,
    granted_by: grantedBy,
    note,
  });
  // 23505: a concurrent grant got there first — same outcome.
  return { error: error && error.code !== "23505" ? error : null };
}

export async function revokeAmbassadorRole(service: Service, participantId: number, revokedBy: number | null): Promise<{ error: unknown }> {
  const { error } = await service
    .from("participant_roles")
    .update({ revoked_at: new Date().toISOString(), revoked_by: revokedBy })
    .eq("participant_id", participantId)
    .eq("role", "ambassador")
    .is("revoked_at", null);
  return { error };
}

/** A fresh invite token: 24 random bytes, URL-safe. A bearer secret. */
export function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface AmbassadorInvite {
  id: number;
  token: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  note: string | null;
  inviter_name: string;
  invited_by: number | null;
  lab_id: number | null;
  nomination_id: number | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_participant_id: number | null;
  revoked_at: string | null;
}

export const INVITE_SELECT =
  "id, token, first_name, last_name, email, note, inviter_name, invited_by, lab_id, nomination_id, created_at, expires_at, accepted_at, accepted_participant_id, revoked_at";

export type InviteProblem = "not_found" | "revoked" | "expired" | "used" | "email_mismatch";

/**
 * Look up an invite by its token and say whether this participant may use it.
 * Usable when: not revoked, not expired, not accepted by someone else, and —
 * if the coordinator gave an email — the applicant's email matches.
 */
export async function checkInvite(
  service: Service,
  token: string,
  participant: { id: number; email: string },
  now = new Date()
): Promise<{ invite: AmbassadorInvite | null; problem: InviteProblem | null }> {
  if (!token) return { invite: null, problem: "not_found" };
  const { data } = await service.from("ambassador_invites").select(INVITE_SELECT).eq("token", token).maybeSingle();
  const invite = (data as AmbassadorInvite | null) ?? null;
  return { invite, problem: inviteProblem(invite, participant, now) };
}

export function inviteProblem(
  invite: AmbassadorInvite | null,
  participant: { id: number; email: string },
  now = new Date()
): InviteProblem | null {
  if (!invite) return "not_found";
  if (invite.revoked_at) return "revoked";
  if (invite.accepted_participant_id && invite.accepted_participant_id !== participant.id) return "used";
  if (!invite.accepted_participant_id && new Date(invite.expires_at).getTime() <= now.getTime()) return "expired";
  if (invite.email && invite.email.trim().toLowerCase() !== participant.email.trim().toLowerCase()) return "email_mismatch";
  return null;
}

/** The participant behind a share link's ?ref=<handle>, if real and not self. */
export async function resolveReferrer(service: Service, handle: string | undefined, selfId: number): Promise<number | null> {
  const h = (handle ?? "").trim().toLowerCase();
  if (!h || !/^[a-z0-9-]{1,80}$/.test(h)) return null;
  const { data } = await service.from("participants").select("id").eq("handle", h).maybeSingle();
  return data && data.id !== selfId ? (data.id as number) : null;
}

/** The review rows (00105) for these applications, every round. */
export async function reviewsFor(service: Service, applicationIds: number[]): Promise<AmbassadorReview[]> {
  if (applicationIds.length === 0) return [];
  const { data } = await service
    .from("ambassador_reviews")
    .select(REVIEW_SELECT)
    .in("application_id", applicationIds)
    .order("created_at", { ascending: true });
  return (data ?? []) as AmbassadorReview[];
}

/** Record one review. 23505 (this reviewer already has a counting review)
 *  comes back as `duplicate` so the caller can say so. */
export async function recordReview(
  service: Service,
  review: { applicationId: number; reviewerId: number; decision: ReviewDecision; note?: string | null; source?: "review" | "invite" }
): Promise<{ error: unknown; duplicate: boolean }> {
  const { error } = await service.from("ambassador_reviews").insert({
    application_id: review.applicationId,
    reviewer_id: review.reviewerId,
    decision: review.decision,
    note: review.note ?? null,
    source: review.source ?? "review",
  });
  if (error?.code === "23505") return { error: null, duplicate: true };
  return { error, duplicate: false };
}

/** A new review round (reopen): earlier reviews stay as history. */
export async function supersedeReviews(service: Service, applicationId: number): Promise<{ error: unknown }> {
  const { error } = await service
    .from("ambassador_reviews")
    .update({ superseded_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .is("superseded_at", null);
  return { error };
}

/**
 * Apply the current round's outcome to a pending application: two approvals
 * grant the role and approve it; two declines (or a split broken by an admin)
 * decline it. Open rounds and splits leave it pending. Idempotent — the grant
 * is, and an already-decided application is returned as is.
 *
 * A review-driven decline leaves decision_note empty: reviewer notes are for
 * reviewers, so the applicant sees the plain "not this time" copy.
 */
export async function settleApplication(
  service: Service,
  app: AmbassadorApplication
): Promise<{ application: AmbassadorApplication; error: unknown }> {
  if (app.status !== "pending") return { application: app, error: null };
  const reviews = activeReviews(await reviewsFor(service, [app.id]));
  const outcome = reviewOutcome(reviews);
  if (outcome.state !== "approved" && outcome.state !== "declined") return { application: app, error: null };

  // The review that settled it decides who's recorded as the decider.
  const decider = [...reviews].reverse().find((r) => r.decision === (outcome.state === "approved" ? "approve" : "decline"));
  const deciderId = decider?.reviewer_id ?? null;
  const now = new Date().toISOString();

  if (outcome.state === "approved") {
    const { error } = await grantAmbassadorRole(service, app.participant_id, app.lab_id, deciderId, `Approved by two reviewers, application #${app.id}`);
    if (error) return { application: app, error };
  }
  const { data, error } = await service
    .from("ambassador_applications")
    .update({
      status: outcome.state,
      decided_at: now,
      decided_by: deciderId,
      decision_note: null,
      updated_at: now,
    })
    .eq("id", app.id)
    .eq("status", "pending")
    .select(APPLICATION_SELECT)
    .maybeSingle();
  if (error) return { application: app, error };
  // No row: a concurrent settle got there first — re-read the result.
  if (!data) {
    const { data: again } = await service.from("ambassador_applications").select(APPLICATION_SELECT).eq("id", app.id).single();
    return { application: (again as AmbassadorApplication) ?? app, error: null };
  }
  return { application: data as AmbassadorApplication, error: null };
}

/** Applications waiting on this coordinator (pending submissions this person
 *  may review now + ambassadors who said they're ready but haven't had their
 *  button). For the dashboard. */
export async function coordinatorQueueCount(service: Service, user: UserRoles): Promise<number> {
  const labs = coordinatorLabs(user);
  if (labs && labs.length === 0) return 0;
  let pending = service
    .from("ambassador_applications")
    .select("id, status, participant_id, referred_by_participant_id")
    .eq("status", "pending");
  let ready = service
    .from("ambassador_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .not("ready_at", "is", null)
    .is("button_given_at", null);
  if (labs) {
    pending = pending.in("lab_id", labs);
    ready = ready.in("lab_id", labs);
  }
  const [a, b] = await Promise.all([pending, ready]);
  const apps = (a.data ?? []) as Pick<AmbassadorApplication, "id" | "status" | "participant_id" | "referred_by_participant_id">[];
  const reviews = await reviewsFor(service, apps.map((x) => x.id));
  const who = { reviewerId: user.participantId, reviewerIsAdmin: isAdmin(user) };
  const waiting = apps.filter((x) => awaitsReviewer(x, reviews.filter((r) => r.application_id === x.id), who)).length;
  return waiting + (b.count ?? 0);
}

/** How many new ambassadors came in through this one's share link — the
 *  "pass it on" count the pin is earned by. */
export async function referralCount(service: Service, participantId: number): Promise<number> {
  const { count } = await service
    .from("ambassador_applications")
    .select("id", { count: "exact", head: true })
    .eq("referred_by_participant_id", participantId)
    .in("status", ["pending", "approved"]);
  return count ?? 0;
}
