import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { requireLabAccess } from "@/lib/auth/lab";
import { isAdmin } from "@/lib/auth/roles";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { ambassadorDecisionSchema } from "@/lib/validations/ambassador";
import {
  APPLICATION_SELECT,
  grantAmbassadorRole,
  recordReview,
  reviewsFor,
  revokeAmbassadorRole,
  settleApplication,
  supersedeReviews,
} from "@/lib/ambassador/data";
import { REVIEW_BLOCK_MESSAGE, reviewBlock } from "@/lib/ambassador/review";
import type { AmbassadorApplication } from "@/lib/ambassador/status";

/**
 * A coordinator's action on one application (/ambassador/coordinator).
 * Scope: admin, or a lead of the application's Lab (HQ rows: admin only).
 *
 *   review       pending: record this reviewer's approve/decline (00105).
 *                Two approvals grant the role; two declines decline; a split
 *                waits for an admin's third review (lib/ambassador/review.ts).
 *   reopen       declined → pending, a fresh review round
 *   approve      stepped_back → approved: reinstate, and re-grant the role
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
  const me = auth.user.participantId;
  if (app.participant_id === me) {
    return NextResponse.json({ error: "Someone else decides on your own application." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const conflict = (msg: string) => NextResponse.json({ error: msg }, { status: 409 });

  if (body.action === "review") {
    const reviews = await reviewsFor(service, [app.id]);
    const block = reviewBlock(app, reviews, { reviewerId: me, reviewerIsAdmin: isAdmin(auth.user) });
    if (block) return conflict(REVIEW_BLOCK_MESSAGE[block]);
    const { error, duplicate } = await recordReview(service, {
      applicationId: app.id,
      reviewerId: me!,
      decision: body.decision!,
      note: body.note ?? null,
    });
    if (duplicate) return conflict(REVIEW_BLOCK_MESSAGE.already_reviewed);
    if (error) return dbError(error, "ambassador-review");
    const settled = await settleApplication(service, app);
    if (settled.error) return dbError(settled.error, "ambassador-review-settle");
    return NextResponse.json({ application: settled.application });
  }

  let fields: Record<string, unknown>;
  switch (body.action) {
    case "reopen": {
      if (app.status !== "declined") return conflict("Only a declined application can be reopened.");
      const { error } = await supersedeReviews(service, app.id);
      if (error) return dbError(error, "ambassador-reopen-reviews");
      fields = { status: "pending", decided_at: null, decided_by: null, decision_note: null };
      break;
    }
    case "approve": {
      if (app.status !== "stepped_back") {
        return conflict("A new application is decided by two reviews. Approve only reinstates someone who stepped back.");
      }
      const { error } = await grantAmbassadorRole(service, app.participant_id, app.lab_id, me, `Reinstated, application #${app.id}`);
      if (error) return dbError(error, "ambassador-reinstate-grant");
      fields = { status: "approved", decided_at: now, decided_by: me, decision_note: body.note ?? null };
      break;
    }
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
    default:
      return conflict("Unknown action.");
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
