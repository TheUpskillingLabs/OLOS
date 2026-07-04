import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { reactivateSchema } from "@/lib/validations/pods";
import { reconcileEnrollmentActivation } from "@/lib/enrollment/reconciler";

// Admin reactivation. Memberships are restored first; the enrollment status
// then follows membership reality via the reconciler (§3.7: one write path).
// Consequence of the single source of truth: if the restored memberships'
// pods aren't status='active', the enrollment stays inactive — the response
// reports the reconciled status so the admin sees what actually happened.
export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    const body = await parseBody(request, reactivateSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id } = body;

    // 1. Restore THIS CYCLE's pod memberships. Two-step (select ids, then
    //    update by id): PostgREST embedded filters on an UPDATE only shape
    //    the returned rows, not the mutation — the previous joined filter
    //    restored memberships across every cycle while reporting one.
    const { data: revokedMemberships } = await auth.supabase
      .from("pod_memberships")
      .select("id, pod_id, pods!inner(cycle_id)")
      .eq("participant_id", participantId)
      .eq("pods.cycle_id", cycle_id)
      .not("inactive_at", "is", null);

    const membershipIds = (revokedMemberships ?? []).map((m) => m.id);
    if (membershipIds.length > 0) {
      await auth.supabase
        .from("pod_memberships")
        .update({ inactive_at: null })
        .in("id", membershipIds);
    }
    const restoredPods = (revokedMemberships ?? []).map((m) => m.pod_id);

    // 2. Restore project memberships (project_memberships carries cycle_id)
    const { data: projectMemberships } = await auth.supabase
      .from("project_memberships")
      .update({ left_at: null })
      .eq("participant_id", participantId)
      .eq("cycle_id", cycle_id)
      .not("left_at", "is", null)
      .select("project_id");

    const restoredProjects = (projectMemberships || []).map((m) => m.project_id);

    // 3. Enrollment status follows the restored memberships — reconciler,
    //    never a direct status write.
    const reconciled = await reconcileEnrollmentActivation(
      participantId,
      cycle_id
    );

    // 4. Record reactivation in audit trail
    await auth.supabase.from("access_revocations").insert({
      participant_id: participantId,
      cycle_id,
      reason: "reactivated",
      revocation_scope: "full",
      revoked_systems: ["reactivated"],
    });

    return NextResponse.json({
      success: true,
      participant_id: participantId,
      enrollment_status: reconciled.after,
      restored_pods: restoredPods,
      restored_projects: restoredProjects,
      restored_systems: ["enrollment", "pod_membership", "project_membership"],
    });
  }
);
