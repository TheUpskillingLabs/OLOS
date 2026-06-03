import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { adminPodStatusSchema } from "@/lib/validations/admin-pod-status";
import { reconcilePodMembers } from "@/lib/enrollment/reconciler";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

/**
 * PATCH /api/admin/pods/[pod_id]
 *
 * Admin pod-status override. Closes architecture review broken edge #14
 * ('Admin can force pod status forming → active: No PATCH route exists').
 *
 * Concrete scenario this exists for: Pod 8 from the May 2026 Energy hot
 * fix had 8 active members (pod_min=5) but stayed in 'forming' because
 * the auto-transition in the participant register route never fired
 * for any of those members. Pre-Phase-B that required a manual SQL
 * UPDATE; this route makes it a clickable admin action.
 *
 * Allowed transitions
 * -------------------
 *   forming → active   — the primary use case
 *   forming → forming  — no-op (returns success without writing)
 *   active  → active   — no-op (returns success without writing)
 *   active  → forming  — REJECTED (400)
 *
 * Why active → forming is rejected
 * ---------------------------------
 * Architecture brief invariant #4 ('Resources provision at activation,
 * not formation') means that once a pod is 'active', external systems
 * (Slack channel, Drive folder, GitHub repo, Google Group) have been
 * provisioned (or will be, once that work lands). Reversing 'active' to
 * 'forming' would imply de-provisioning those resources — a destructive
 * operation that's both more complex than this route should attempt and
 * not a documented operator need today. If a use case for archival or
 * reversal emerges, that's a separate route with explicit semantics, not
 * an overload of this endpoint.
 *
 * Why pod_min is NOT checked
 * --------------------------
 * The participant-facing register route only flips a pod to active when
 * pod_member count >= pod_min. This admin override deliberately skips
 * that check — the whole point is to handle the two cases where the
 * auto-check fails:
 *   (a) Pod 8 case: pod_min was reached but the inline activation in
 *       the register route silently RLS-failed (Phase A's discovery)
 *   (b) Operator wants to activate a pod below pod_min for a special
 *       case (e.g. a small experimental cohort)
 *
 * Resource provisioning gap
 * --------------------------
 * Brief invariant #4 says active pods get external resources provisioned.
 * The current codebase has NO resource-provisioning code anywhere — the
 * participant register route's activation block also doesn't provision.
 * That gap is intentional out-of-scope for #110; when provisioning
 * lands, it'll land in BOTH this route AND the participant register
 * route's activation block via a shared helper. This route's contract
 * (when provisioning ships): admin override fires provisioning the same
 * way an automatic transition does.
 *
 * Reconciler integration
 * ----------------------
 * After a forming → active transition, calls reconcilePodMembers(podId)
 * which fans out reconcileEnrollmentActivation across every active
 * member of the pod. Each member's cycle_enrollments.status flips to
 * 'active' (if it wasn't already). Idempotent: members who are already
 * active are no-op'd.
 *
 * === KNOWN GAP — admin audit trail ===
 *
 * This route mutates pods.status without recording which admin made the
 * change or why. Same gap as B.6's admin pod-membership routes; tracked
 * for coordinated fix at #115. The recommended audit migration there
 * adds pod-level audit columns (status_changed_by_admin_id,
 * status_change_reason, status_changed_at) alongside the pod_memberships
 * audit columns so all admin write surfaces land observability at once.
 *
 * Where this is headed: once #115 lands, this route writes
 *   status_changed_by_admin_id = auth.user.participantId
 *   status_change_reason       = body.reason  (schema gets a reason field)
 *   status_changed_at          = now()
 * and the schema in lib/validations/admin-pod-status.ts grows an
 * optional reason field. No structural change to the route's control
 * flow.
 */
export const PATCH = withAdminAuth(
  async (request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const body = await parseBody(request, adminPodStatusSchema);
    if (isErrorResponse(body)) return body;
    const { status: newStatus } = body;

    const client = createServiceClient();

    const { data: pod } = await client
      .from("pods")
      .select("id, cycle_id, status")
      .eq("id", podId)
      .maybeSingle();
    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    // No-op fast path: status already matches.
    if (pod.status === newStatus) {
      return NextResponse.json({ pod_id: pod.id, status: pod.status });
    }

    // Reject active → forming. See route header for rationale.
    if (pod.status === "active" && newStatus === "forming") {
      return NextResponse.json(
        {
          error:
            "Cannot revert active pod to forming. Reversing activation would " +
            "imply de-provisioning external resources, which is not a " +
            "supported operation. Open a separate ticket if this need is real.",
        },
        { status: 400 }
      );
    }

    // Reject anything else that wasn't no-op or forming → active.
    if (!(pod.status === "forming" && newStatus === "active")) {
      return NextResponse.json(
        { error: `Unsupported transition: ${pod.status} → ${newStatus}` },
        { status: 400 }
      );
    }

    // forming → active path
    const { error } = await client
      .from("pods")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", podId);
    if (error) return dbError(error);

    // Reconcile every active member's enrollment status. Idempotent;
    // members already at status='active' are no-op'd. Members who
    // joined after a soft-delete/rejoin cycle get their enrollment
    // brought current.
    await reconcilePodMembers(podId);

    return NextResponse.json({ pod_id: pod.id, status: "active" });
  }
);
