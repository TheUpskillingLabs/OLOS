import { NextRequest, NextResponse } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import { requireCycleManagement } from "@/lib/auth/cycle-access";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { reconcileEnrollmentActivation } from "@/lib/enrollment/reconciler";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

/**
 * DELETE /api/admin/pods/[pod_id]/memberships/[participant_id]
 *
 * Admin override of the participant-facing leave-pod route. Used to remove
 * a participant from a pod on their behalf (architecture review broken
 * edge #13).
 *
 * Soft-deletes per architecture brief §5 (sets inactive_at; preserves the
 * row + joined_at). Calls the Phase A reconciler so the participant's
 * cycle_enrollments status demotes to 'inactive' iff this was their last
 * active pod in the cycle. Reconciler is idempotent — calling it when
 * the participant still has another active pod is a no-op.
 *
 * Does NOT check the pod_registration window — admins are explicitly
 * allowed to act outside windows for remediation.
 *
 * === KNOWN GAP — admin audit trail ===
 *
 * This DELETE sets inactive_at but records nothing about WHICH admin
 * triggered the removal or WHY. If a participant asks "why am I out of
 * Pod 5?" tomorrow, the database holds the timestamp but not the actor
 * or reason. Same gap as the sibling POST route (and the forthcoming
 * Phase B.7 pod-status override + B.8 reconciler-trigger).
 *
 * The recommended follow-up adds three columns to pod_memberships:
 *   - removed_by_admin_id INT NULL REFERENCES participants(id)
 *   - removal_reason      VARCHAR(255)
 *   - admin_action_at     TIMESTAMP
 *
 * And updates this route to:
 *   - Accept an optional { reason?: string } in the request body
 *   - Write removed_by_admin_id = auth.user.participantId
 *   - Write removal_reason from the body (or a default 'admin action')
 *   - Write admin_action_at = now()
 *
 * Deferred deliberately: the audit columns should land in ONE migration
 * covering all three Phase B admin write surfaces (B.6 + B.7 + B.8), not
 * three separate follow-ups. Architecture brief §5 ('audit trail') is
 * partially honored — rows persist via soft-delete — but actor-level
 * audit is the gap. Tracked at #115.
 *
 * Where this is headed: once the audit columns land, the access_revocations
 * table continues to log cycle_enrollment demotions (the reconciler still
 * writes there when logRevocation=true), while the new pod_memberships
 * audit columns capture pod-level admin actions. Two layers, two
 * concerns: enrollment status changes (access_revocations) vs membership
 * actions (pod_memberships audit columns).
 */
export const DELETE = withPermissionAuth(
  "pods:write",
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    const client = createServiceClient();

    const { data: pod } = await client
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .maybeSingle();
    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const guard = await requireCycleManagement(auth.supabase, auth.user, pod.cycle_id);
    if (guard) return guard;

    const { error } = await client
      .from("pod_memberships")
      .update({ inactive_at: new Date().toISOString() })
      .eq("pod_id", podId)
      .eq("participant_id", participantId)
      .is("inactive_at", null);
    if (error) return dbError(error);

    await reconcileEnrollmentActivation(participantId, pod.cycle_id);

    return NextResponse.json({ success: true });
  }
);
