import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const participantId = parseInt(params.participant_id);
    const body = await request.json();
    const { cycle_id } = body;

    if (!cycle_id) {
      return NextResponse.json({ error: "cycle_id is required" }, { status: 400 });
    }

    // 1. Restore enrollment
    await auth.supabase
      .from("cycle_enrollments")
      .update({ status: "active", inactive_date: null })
      .eq("participant_id", participantId)
      .eq("cycle_id", cycle_id);

    // 2. Restore pod memberships
    const { data: podMemberships } = await auth.supabase
      .from("pod_memberships")
      .update({ inactive_at: null })
      .eq("participant_id", participantId)
      .not("inactive_at", "is", null)
      .select("pod_id, pods!inner(cycle_id)")
      .eq("pods.cycle_id", cycle_id);

    const restoredPods = (podMemberships || []).map((m) => m.pod_id);

    // 3. Restore project memberships
    const { data: projectMemberships } = await auth.supabase
      .from("project_memberships")
      .update({ left_at: null })
      .eq("participant_id", participantId)
      .eq("cycle_id", cycle_id)
      .not("left_at", "is", null)
      .select("project_id");

    const restoredProjects = (projectMemberships || []).map((m) => m.project_id);

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
      restored_pods: restoredPods,
      restored_projects: restoredProjects,
      restored_systems: ["enrollment", "pod_membership", "project_membership"],
    });
  }
);
