import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);

    // Get pod with problem statement
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("id, name, problem_statements(statement_text)")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    // Get members with their last pulse check
    const { data: members } = await auth.supabase
      .from("pod_memberships")
      .select(`
        participant_id, inactive_at,
        participants (first_name, last_name, preferred_name)
      `)
      .eq("pod_id", podId);

    const memberData = [];
    for (const m of members || []) {
      const p = (m.participants as unknown) as Record<string, unknown>;

      const { data: lastPulse } = await auth.supabase
        .from("pulse_checks")
        .select("completed_at, scheduled_date")
        .eq("participant_id", m.participant_id)
        .not("completed_at", "is", null)
        .order("scheduled_date", { ascending: false })
        .limit(1);

      memberData.push({
        participant_id: m.participant_id,
        name: `${p?.preferred_name || p?.first_name || ""} ${p?.last_name || ""}`.trim(),
        status: m.inactive_at ? "inactive" : "active",
        last_pulse_check: lastPulse?.[0]?.completed_at || null,
      });
    }

    return NextResponse.json({
      pod_name: pod.name,
      problem_statement: ((pod.problem_statements as unknown) as Record<string, string>)?.statement_text,
      members: memberData,
    });
  }
);
