import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { reactivateSchema } from "@/lib/validations/pods";

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    const body = await parseBody(request, reactivateSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id } = body;

    // Find the revocation we're reversing: the most recent real revocation
    // (not a prior 'reactivated' marker) for this participant + cycle. If
    // there is none, this is a no-op — return 409 instead of a misleading
    // success + spurious audit row (audit fix).
    const { data: revocation } = await auth.supabase
      .from("access_revocations")
      .select("revoked_at")
      .eq("participant_id", participantId)
      .eq("cycle_id", cycle_id)
      .neq("reason", "reactivated")
      .order("revoked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!revocation) {
      return NextResponse.json(
        { error: "This participant has no revocation to reverse in this cycle." },
        { status: 409 }
      );
    }
    const revokedAt = revocation.revoked_at;

    // 1. Restore enrollment (only if not already active).
    const { data: restoredEnrollment } = await auth.supabase
      .from("cycle_enrollments")
      .update({ status: "active", inactive_date: null })
      .eq("participant_id", participantId)
      .eq("cycle_id", cycle_id)
      .neq("status", "active")
      .select("id");

    // 2. Restore ONLY the pod memberships the revocation deactivated
    //    (inactive_at at/after the revocation) — never pods the participant
    //    voluntarily left before it — and respect the 2-pod cap (audit fix:
    //    reactivate previously resurrected deliberately-left pods and could
    //    breach the cap).
    const { data: activeMemberships } = await auth.supabase
      .from("pod_memberships")
      .select("id, pods!inner(cycle_id)")
      .eq("participant_id", participantId)
      .is("inactive_at", null)
      .eq("pods.cycle_id", cycle_id);
    const activeCount = (activeMemberships || []).length;
    const restoreSlots = Math.max(0, 2 - activeCount);

    const { data: candidates } = await auth.supabase
      .from("pod_memberships")
      .select("id, pod_id, pods!inner(cycle_id)")
      .eq("participant_id", participantId)
      .not("inactive_at", "is", null)
      .gte("inactive_at", revokedAt)
      .eq("pods.cycle_id", cycle_id)
      .order("inactive_at", { ascending: false });

    const toRestore = (candidates || []).slice(0, restoreSlots);
    const restoredPods: number[] = [];
    if (toRestore.length > 0) {
      await auth.supabase
        .from("pod_memberships")
        .update({ inactive_at: null })
        .in(
          "id",
          toRestore.map((m) => m.id)
        );
      restoredPods.push(...toRestore.map((m) => m.pod_id));
    }

    // 3. Restore project memberships the revocation ended (left_at at/after it).
    const { data: projectMemberships } = await auth.supabase
      .from("project_memberships")
      .update({ left_at: null })
      .eq("participant_id", participantId)
      .eq("cycle_id", cycle_id)
      .not("left_at", "is", null)
      .gte("left_at", revokedAt)
      .select("project_id");

    const restoredProjects = (projectMemberships || []).map((m) => m.project_id);

    // If nothing was actually restored, the participant was already active —
    // don't write a spurious audit row or claim success.
    if (
      (restoredEnrollment?.length ?? 0) === 0 &&
      restoredPods.length === 0 &&
      restoredProjects.length === 0
    ) {
      return NextResponse.json(
        { error: "Participant is already active in this cycle; nothing to reactivate." },
        { status: 409 }
      );
    }

    // 4. Record reactivation in the audit trail (only after a real change).
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
