import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { adminReconcileSchema } from "@/lib/validations/admin-reconcile";
import { reconcileEnrollmentActivation } from "@/lib/enrollment/reconciler";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

/**
 * POST /api/admin/participants/[participant_id]/reconcile
 *
 * Operator-driven trigger for the Phase A reconciler. Used by the
 * "Run reconciler" button on the admin participants-table filter for
 * "stuck inactive" enrollments — participants whose cycle_enrollments
 * row is 'inactive' AND who have no access_revocations entry, meaning
 * they were never legitimately revoked, just never activated in the
 * first place (architecture review broken edge #15).
 *
 * Body: { cycle_id: number }
 * Auth: withAdminAuth
 * Returns: { participantId, cycleId, before, after, mutated, audited }
 *          (the full ReconcileResult so the UI can show what changed)
 *
 * Behavior
 * --------
 * Calls reconcileEnrollmentActivation with no logRevocation flag. The
 * reconciler is idempotent:
 *   - If the participant has at least one active pod_membership in an
 *     active pod, status flips to 'active' and the result reports
 *     mutated=true, after='active'
 *   - If they have no active memberships, the reconciler leaves status
 *     as-is (also no-op) OR demotes to 'inactive' depending on current
 *     state. Either way it's safe to call.
 *
 * Architecture alignment
 * ----------------------
 *   - Brief invariant #2 (roles stack): withAdminAuth gate
 *   - Brief invariant #4 (resources at activation): when reconciler
 *     flips inactive → active for a participant whose pod is itself
 *     active, downstream resource provisioning would fire if/when that
 *     code lands. Same gap as B.7's pod-status override; not coded
 *     anywhere yet.
 *   - Brief invariant #5 (audit): reconciler writes access_revocations
 *     only on demotion + opts.logRevocation. Admin-triggered activation
 *     doesn't need a revocation row; the StatusBadge in the UI is
 *     itself the visible record.
 *
 * === KNOWN GAP — admin audit trail ===
 *
 * No record of which admin clicked Run reconciler for which participant.
 * Same deferral as B.6/B.7; tracked at #115 for the coordinated audit
 * migration. The recommended audit will add a small action log (e.g.
 * admin_actions table) capturing actor + target + timestamp + reason
 * for every Phase B admin write surface — including this one. Until
 * then, the cycle_enrollments status change is the only signal, and
 * the access_revocations table covers cron-driven demotions (not
 * admin-driven activations).
 *
 * Where this is headed: once #115 lands, the route accepts an optional
 * { reason?: string } in the body, writes an admin_actions row, and the
 * participants-table renders "Last reconciled by X on Y" alongside the
 * status badge.
 */
export const POST = withAdminAuth(
  async (request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    const body = await parseBody(request, adminReconcileSchema);
    if (isErrorResponse(body)) return body;

    const result = await reconcileEnrollmentActivation(
      participantId,
      body.cycle_id
    );

    return NextResponse.json(result);
  }
);
