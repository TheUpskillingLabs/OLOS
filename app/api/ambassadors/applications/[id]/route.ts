import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { requireLabAccess } from "@/lib/auth/lab";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { ambassadorDecisionSchema } from "@/lib/validations/ambassador";
import { APPLICATION_SELECT, grantAmbassadorRole, revokeAmbassadorRole } from "@/lib/ambassador/data";
import type { AmbassadorApplication } from "@/lib/ambassador/status";

/**
 * A coordinator's decision on one application (/ambassador/coordinator).
 * Scope: admin, or a lead of the application's Lab (HQ rows: admin only).
 *
 *   approve      pending|declined|stepped_back → approved, and grant the role
 *   decline      pending → declined (with an optional note to the applicant)
 *   reopen       declined → pending
 *   button_given approved → the button was handed over, in person
 *   step_back    approved → stepped_back, and revoke the role
 */
export const PATCH = withAuth(async (request: NextRequest, auth, params) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad id." }, { status: 400 });
  const body = await parseBody(request, ambassadorDecisionSchema);
  if (isErrorResponse(body)) return body;

  const service = createServiceClient();
  const { data } = await service.from("ambassador_applications").select(APPLICATION_SELECT).eq("id", id).maybeSingle();
  const app = data as AmbassadorApplication | null;
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const denied = requireLabAccess(auth.user, app.lab_id);
  if (denied) return denied;
  if (app.participant_id === auth.user.participantId) {
    return NextResponse.json({ error: "Someone else decides on your own application." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const me = auth.user.participantId;
  const conflict = (msg: string) => NextResponse.json({ error: msg }, { status: 409 });
  let fields: Record<string, unknown>;

  switch (body.action) {
    case "approve": {
      if (app.status === "approved" || app.status === "started") return conflict("Only a submitted application can be approved.");
      const { error } = await grantAmbassadorRole(service, app.participant_id, app.lab_id, me, `Approved application #${app.id}`);
      if (error) return dbError(error, "ambassador-approve-grant");
      fields = { status: "approved", decided_at: now, decided_by: me, decision_note: body.note ?? null };
      break;
    }
    case "decline":
      if (app.status !== "pending") return conflict("Only a waiting application can be declined.");
      fields = { status: "declined", decided_at: now, decided_by: me, decision_note: body.note ?? null };
      break;
    case "reopen":
      if (app.status !== "declined") return conflict("Only a declined application can be reopened.");
      fields = { status: "pending", decided_at: null, decided_by: null, decision_note: null };
      break;
    case "button_given":
      if (app.status !== "approved") return conflict("Only an ambassador gets a button.");
      fields = { button_given_at: app.button_given_at ?? now, button_given_by: app.button_given_by ?? me };
      break;
    case "step_back": {
      if (app.status !== "approved") return conflict("Only an ambassador can step back.");
      const { error } = await revokeAmbassadorRole(service, app.participant_id, me);
      if (error) return dbError(error, "ambassador-step-back");
      fields = { status: "stepped_back", decided_at: now, decided_by: me, decision_note: body.note ?? null };
      break;
    }
  }

  const { data: updated, error } = await service
    .from("ambassador_applications")
    .update({ ...fields, updated_at: now })
    .eq("id", id)
    .select(APPLICATION_SELECT)
    .single();
  if (error) return dbError(error, "ambassador-decision");
  return NextResponse.json({ application: updated });
});
