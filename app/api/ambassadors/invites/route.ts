import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { requireLabAccess } from "@/lib/auth/lab";
import { isAdmin } from "@/lib/auth/roles";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { ambassadorInviteSchema } from "@/lib/validations/ambassador";
import { INVITE_SELECT, isCoordinator, newInviteToken } from "@/lib/ambassador/data";
import { AMBASSADOR_START } from "@/lib/ambassador/content";

/**
 * A coordinator's pre-approved ambassador invite — the OLOS twin of the
 * prototype's /invite/ page. The invitee still watches, passes the quiz and
 * signs the agreement; then they're in straight away. The link carries a
 * random single-use token (a bearer secret, like the prototype's link); when
 * an email is given it must also match the account that uses it.
 *
 * Lab leads invite into their own Lab; admins into any Lab, or HQ (no Lab).
 */
export const POST = withAuth(async (request: NextRequest, auth) => {
  if (!isCoordinator(auth.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await parseBody(request, ambassadorInviteSchema);
  if (isErrorResponse(body)) return body;

  // A lead with one Lab needn't pick it.
  const labId =
    body.lab_id ?? (!isAdmin(auth.user) && auth.user.labLeadLabIds.length === 1 ? auth.user.labLeadLabIds[0] : null);
  const denied = requireLabAccess(auth.user, labId);
  if (denied) return denied;

  const service = createServiceClient();
  if (body.nomination_id) {
    const { data: nom } = await service.from("ambassador_nominations").select("id, lab_id").eq("id", body.nomination_id).maybeSingle();
    if (!nom) return NextResponse.json({ error: "Nomination not found." }, { status: 404 });
    const nomDenied = requireLabAccess(auth.user, nom.lab_id);
    if (nomDenied) return nomDenied;
  }

  const { data, error } = await service
    .from("ambassador_invites")
    .insert({
      token: newInviteToken(),
      first_name: body.first_name,
      last_name: body.last_name || null,
      email: body.email ? body.email.toLowerCase() : null,
      note: body.note || null,
      inviter_name: body.inviter_name,
      invited_by: auth.user.participantId,
      lab_id: labId,
      nomination_id: body.nomination_id ?? null,
    })
    .select(INVITE_SELECT)
    .single();
  if (error) return dbError(error, "ambassador-invite-create");

  if (body.nomination_id) {
    await service
      .from("ambassador_nominations")
      .update({ status: "invited", decided_by: auth.user.participantId, decided_at: new Date().toISOString() })
      .eq("id", body.nomination_id);
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.json({ invite: data, link: `${origin}${AMBASSADOR_START}?invite=${data.token}` }, { status: 201 });
});
