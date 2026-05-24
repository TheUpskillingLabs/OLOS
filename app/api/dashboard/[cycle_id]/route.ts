import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    // Get cycle
    const { data: cycle } = await auth.supabase
      .from("cycles")
      .select("name")
      .eq("id", cycleId)
      .single();

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    // Get enrollment counts
    const { data: enrollments } = await auth.supabase
      .from("cycle_enrollments")
      .select("status")
      .eq("cycle_id", cycleId);

    const totalEnrolled = enrollments?.length || 0;
    const activeParticipants =
      enrollments?.filter((e) => e.status === "active").length || 0;

    // Get pods with member counts
    const { data: pods } = await auth.supabase
      .from("pods")
      .select("id, name")
      .eq("cycle_id", cycleId);

    const podIds = (pods || []).map((p) => p.id);
    const { data: allMemberships } = podIds.length
      ? await auth.supabase
          .from("pod_memberships")
          .select("pod_id, inactive_at")
          .in("pod_id", podIds)
      : { data: [] };

    const membershipsByPod = new Map<number, { inactive_at: string | null }[]>();
    for (const m of allMemberships || []) {
      const list = membershipsByPod.get(m.pod_id) ?? [];
      list.push(m);
      membershipsByPod.set(m.pod_id, list);
    }

    const podSummaries = (pods || []).map((pod) => {
      const members = membershipsByPod.get(pod.id) ?? [];
      return {
        id: pod.id,
        name: pod.name,
        member_count: members.length,
        active_count: members.filter((m) => !m.inactive_at).length,
        revoked_count: members.filter((m) => m.inactive_at).length,
      };
    });

    // Pulse check status
    const { data: pulseChecks } = await auth.supabase
      .from("pulse_checks")
      .select("completed_at")
      .eq("cycle_id", cycleId);

    const sentCount = pulseChecks?.length || 0;
    const completedCount =
      pulseChecks?.filter((p) => p.completed_at).length || 0;

    // Recent revocations
    const { data: revocations } = await auth.supabase
      .from("access_revocations")
      .select("participant_id, reason, revoked_at")
      .eq("cycle_id", cycleId)
      .neq("reason", "reactivated")
      .order("revoked_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      cycle_name: cycle.name,
      total_enrolled: totalEnrolled,
      active_participants: activeParticipants,
      pods: podSummaries,
      pulse_check_status: {
        sent_count: sentCount,
        completed_count: completedCount,
        completion_rate: sentCount > 0 ? completedCount / sentCount : 0,
      },
      recent_revocations: revocations || [],
    });
  }
);
