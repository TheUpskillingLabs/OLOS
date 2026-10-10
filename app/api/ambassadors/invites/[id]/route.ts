import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { requireLabAccess } from "@/lib/auth/lab";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { admitInvitee, APPLICATION_SELECT, INVITE_SELECT, recordReview, type AmbassadorInvite } from "@/lib/ambassador/data";
import type { AmbassadorApplication } from "@/lib/ambassador/status";

/** Revoke an unused invite: its link stops working. Same scope as creating. */
export const DELETE = withAuth(async (_request, auth, params) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad id." }, { status: 400 });

  const service = createServiceClient();
  const { data: invite } = await service
    .from("ambassador_invites")
    .select("id, lab_id, accepted_at, revoked_at")
    .eq("id", id)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const denied = requireLabAccess(auth.user, invite.lab_id);
  if (denied) return denied;
  if (invite.accepted_at) return NextResponse.json({ error: "That invite was already used." }, { status: 409 });
  if (invite.revoked_at) return NextResponse.json({ ok: true });

  const { error } = await service
    .from("ambassador_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return dbError(error, "ambassador-invite-revoke");
  return NextResponse.json({ ok: true });
});

/**
 * Approve an invite so it can grant the role (00106). A coordinator drafts an
 * invite; a DIFFERENT coordinator of that Lab (or an admin) approves it. Same
 * scope as creating. If the invitee already finished onboarding while it
 * waited, they become an ambassador now.
 */
export const PATCH = withAuth(async (_request: NextRequest, auth, params) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  const me = auth.user.participantId;
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data } = await service.from("ambassador_invites").select(INVITE_SELECT).eq("id", id).maybeSingle();
  const invite = data as AmbassadorInvite | null;
  if (!invite) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const denied = requireLabAccess(auth.user, invite.lab_id);
  if (denied) return denied;
  if (invite.invited_by === me) {
    return NextResponse.json({ error: "Someone else approves your invite." }, { status: 403 });
  }
  if (invite.revoked_at) return NextResponse.json({ error: "That invite was withdrawn." }, { status: 409 });
  if (invite.approved_at) return NextResponse.json({ invite });
  if (!invite.accepted_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "That invite has expired." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: approved, error } = await service
    .from("ambassador_invites")
    .update({ approved_at: now, approved_by: me })
    .eq("id", id)
    .is("approved_at", null)
    .select(INVITE_SELECT)
    .maybeSingle();
  if (error) return dbError(error, "ambassador-invite-approve");
  if (!approved) return NextResponse.json({ invite });

  // The invitee may already have finished onboarding while this waited.
  if (invite.accepted_participant_id) {
    const { data: appRow } = await service
      .from("ambassador_applications")
      .select(APPLICATION_SELECT)
      .eq("participant_id", invite.accepted_participant_id)
      .maybeSingle();
    const app = appRow as AmbassadorApplication | null;
    if (app && app.status === "pending") {
      const admitted = await admitInvitee(service, app, approved as AmbassadorInvite);
      if (admitted.error) return dbError(admitted.error, "ambassador-invite-admit");
      if (admitted.application) {
        await recordReview(service, {
          applicationId: app.id,
          reviewerId: me,
          decision: "approve",
          note: `Approved invite #${id}`,
          source: "invite",
        });
      }
    }
  }
  return NextResponse.json({ invite: approved });
});
