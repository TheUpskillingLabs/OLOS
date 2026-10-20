import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { requireLabAccess } from "@/lib/auth/lab";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { ambassadorNominationDecisionSchema } from "@/lib/validations/ambassador";

/** Decline (or reopen) a nomination. Inviting one is POST /api/ambassadors/
 *  invites with its nomination_id, which marks it invited. */
export const PATCH = withAuth(async (request: NextRequest, auth, params) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  const body = await parseBody(request, ambassadorNominationDecisionSchema);
  if (isErrorResponse(body)) return body;

  const service = createServiceClient();
  const { data: nom } = await service.from("ambassador_nominations").select("id, lab_id, status").eq("id", id).maybeSingle();
  if (!nom) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const denied = requireLabAccess(auth.user, nom.lab_id);
  if (denied) return denied;

  const fields =
    body.action === "decline"
      ? { status: "declined", decided_by: auth.user.participantId, decided_at: new Date().toISOString() }
      : { status: "open", decided_by: null, decided_at: null };
  if (body.action === "decline" && nom.status !== "open") {
    return NextResponse.json({ error: "Only an open nomination can be declined." }, { status: 409 });
  }
  if (body.action === "reopen" && nom.status !== "declined") {
    return NextResponse.json({ error: "Only a declined nomination can be reopened." }, { status: 409 });
  }

  const { error } = await service.from("ambassador_nominations").update(fields).eq("id", id);
  if (error) return dbError(error, "ambassador-nomination-decision");
  return NextResponse.json({ ok: true });
});
