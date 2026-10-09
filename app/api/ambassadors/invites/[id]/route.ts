import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { requireLabAccess } from "@/lib/auth/lab";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";

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
