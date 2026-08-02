import { createServiceClient } from "@/lib/supabase/server";
import { followPageSilently } from "@/lib/follows/seed";

/**
 * The two states the reconciler manages. 'registered' (committed member, no
 * active pod yet) and 'active' (member with an active pod) are the two ends
 * of the pod-activation axis. 'inactive' (engagement exit) and 'revoked'
 * (archive) live OUTSIDE this axis — the reconciler never writes them and,
 * by default, never touches a row that already holds one (see opts.recover).
 */
export type EnrollmentStatus = "registered" | "active" | "inactive";

export interface ReconcileOptions {
  /**
   * When true, a current exit ('inactive' engagement revocation) is treated
   * as recoverable: the status is re-derived from pod reality (→ 'active' if
   * an active pod exists, else 'registered') and the exit bookkeeping
   * (inactive_date / warned_at / warning_reason) is cleared. The two recovery
   * callers — admin reactivation and auto-recover-on-log — pass this; normal
   * pod join/leave reconciles do not, so an engagement exit stays put until a
   * deliberate recovery.
   */
  recover?: boolean;
}

export interface ReconcileResult {
  participantId: number;
  cycleId: number;
  before: string | null;
  after: string | null;
  mutated: boolean;
}

interface PodMembershipRow {
  id: number;
  pods: { id: number; status: string; cycle_id: number } | null;
}

/**
 * Brings cycle_enrollments.status in line with current pod membership reality
 * for one (participant, cycle) pair. Single source of truth for the
 * registered <-> active enrollment transition across the codebase.
 *
 * Target status:
 *   - 'active' if the participant has at least one active pod_memberships
 *     row (inactive_at IS NULL) whose pod is itself status='active'.
 *   - 'registered' otherwise (committed member, just not in an active pod).
 *
 * The reconciler NEVER writes 'inactive'. That value is an engagement exit
 * owned exclusively by the revocation cron / admin sweep (which also write
 * the access_revocations audit row). Exits are sticky here: a row already at
 * 'inactive' or 'revoked' is left untouched — otherwise the next pod reconcile
 * would silently undo a revocation. Deliberate recovery comes through
 * opts.recover (admin reactivation, or the member's next qualifying log).
 *
 * Idempotent. If no cycle_enrollments row exists, returns without mutating
 * (creation belongs in registration / cycle-interest routes). If status
 * already matches target, returns without mutating.
 *
 * Uses a service client internally because cycle_enrollments is gated by
 * is_admin_or_owner() RLS — a cookie-bound user client would silently
 * no-op the update, which was the pre-#110 bug.
 */
export async function reconcileEnrollmentActivation(
  participantId: number,
  cycleId: number,
  opts: ReconcileOptions = {}
): Promise<ReconcileResult> {
  const client = createServiceClient();

  const { data: enrollment } = await client
    .from("cycle_enrollments")
    .select("id, status")
    .eq("participant_id", participantId)
    .eq("cycle_id", cycleId)
    .maybeSingle();

  const before: string | null = enrollment?.status ?? null;

  if (!enrollment) {
    return { participantId, cycleId, before, after: null, mutated: false };
  }

  // Exits are sticky (see doc above): only a recover call may re-derive them.
  if ((before === "inactive" || before === "revoked") && !opts.recover) {
    return { participantId, cycleId, before, after: before, mutated: false };
  }

  const { data: memberships } = await client
    .from("pod_memberships")
    .select("id, pods!inner(id, status, cycle_id)")
    .eq("participant_id", participantId)
    .eq("pods.cycle_id", cycleId)
    .is("inactive_at", null);

  const rows = (memberships ?? []) as unknown as PodMembershipRow[];
  const hasActivePod = rows.some((m) => m.pods?.status === "active");
  const target: EnrollmentStatus = hasActivePod ? "active" : "registered";

  if (before === target) {
    return { participantId, cycleId, before, after: target, mutated: false };
  }

  const update: {
    status: EnrollmentStatus;
    inactive_date: null;
    warned_at?: null;
    warning_reason?: null;
  } = { status: target, inactive_date: null };

  if (opts.recover) {
    // Recovering out of an exit — clear the engagement-exit bookkeeping so
    // the member is fully reset, not merely re-statused.
    update.warned_at = null;
    update.warning_reason = null;
  }

  await client
    .from("cycle_enrollments")
    .update(update)
    .eq("id", enrollment.id);

  return { participantId, cycleId, before, after: target, mutated: true };
}

/**
 * Ensures a participant holds an active pod_memberships row for `podId`
 * (reactivating a soft-deleted row, inserting a fresh one, or no-op'ing if
 * already active), then upserts an active cycle_enrollments row for
 * `cycleId` and re-runs the reconciler so the enrollment status reflects
 * the membership that now exists.
 *
 * This is the single path an org co-lead/member joins a workstream
 * through — every call site that grants org pod membership (invitation
 * acceptance, admin-assigned org co-lead) should route through here rather
 * than re-implementing the reactivate/insert/no-op branch inline.
 *
 * Ordering is load-bearing: the membership row must exist before the final
 * reconcile call, since reconcileEnrollmentActivation only promotes an
 * enrollment to 'active' by looking at pod_memberships as it stands right
 * now — it does not know about a membership this same request is about to
 * create.
 */
export async function ensureActivePodMembership(
  participantId: number,
  podId: number,
  cycleId: number
): Promise<void> {
  const client = createServiceClient();

  const { data: existingMembership } = await client
    .from("pod_memberships")
    .select("id, inactive_at")
    .eq("pod_id", podId)
    .eq("participant_id", participantId)
    .maybeSingle();

  if (existingMembership) {
    if (existingMembership.inactive_at !== null) {
      await client
        .from("pod_memberships")
        .update({ inactive_at: null })
        .eq("id", existingMembership.id);
    }
  } else {
    await client
      .from("pod_memberships")
      .insert({ participant_id: participantId, pod_id: podId });
  }

  await client
    .from("cycle_enrollments")
    .upsert(
      { participant_id: participantId, cycle_id: cycleId, status: "active" },
      { onConflict: "participant_id,cycle_id" }
    );

  await reconcileEnrollmentActivation(participantId, cycleId);

  // New pod member follows the pod page (and its workstream run, if any) so
  // page updates reach their feed — fires once per membership event, so a
  // later manual unfollow is never overridden (event-driven counterpart of
  // ensurePageFollowsSeeded).
  await followPageSilently(client, participantId, "pod", podId);
  const { data: pod } = await client
    .from("pods")
    .select("workstream_id")
    .eq("id", podId)
    .maybeSingle();
  if (pod?.workstream_id != null) {
    await followPageSilently(
      client,
      participantId,
      "workstream",
      pod.workstream_id
    );
  }
}

/**
 * Convenience: reconcile every active member of a pod for that pod's cycle.
 * Used by callers that just promoted a pod from forming -> active and need
 * every member's enrollment status to follow.
 */
export async function reconcilePodMembers(
  podId: number
): Promise<ReconcileResult[]> {
  const client = createServiceClient();

  const { data: pod } = await client
    .from("pods")
    .select("id, cycle_id")
    .eq("id", podId)
    .maybeSingle();

  if (!pod) return [];

  const { data: memberships } = await client
    .from("pod_memberships")
    .select("participant_id")
    .eq("pod_id", podId)
    .is("inactive_at", null);

  const participantIds = (memberships ?? []).map((m) => m.participant_id);
  if (participantIds.length === 0) return [];

  return Promise.all(
    participantIds.map((pid) => reconcileEnrollmentActivation(pid, pod.cycle_id))
  );
}
