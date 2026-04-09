import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data: pods, error } = await auth.supabase
      .from("pods")
      .select(`
        id, name, problem_statement_id, status,
        slack_channel_id, drive_folder_id, github_repo_url,
        problem_statements (statement_text)
      `)
      .eq("cycle_id", cycleId)
      .order("created_at");

    if (error) {
      return dbError(error);
    }

    // Get registrant counts
    const podIds = (pods || []).map((p) => p.id);
    const { data: memberships } = await auth.supabase
      .from("pod_memberships")
      .select("pod_id")
      .in("pod_id", podIds.length > 0 ? podIds : [0])
      .is("inactive_at", null);

    const countMap: Record<number, number> = {};
    for (const m of memberships || []) {
      countMap[m.pod_id] = (countMap[m.pod_id] || 0) + 1;
    }

    const result = (pods || []).map((p) => ({
      id: p.id,
      name: p.name,
      problem_statement_id: p.problem_statement_id,
      problem_statement_title: ((p.problem_statements as unknown) as Record<string, string>)?.statement_text?.slice(0, 100),
      status: p.status,
      registrant_count: countMap[p.id] || 0,
      slack_channel_id: p.slack_channel_id,
      drive_folder_id: p.drive_folder_id,
      github_repo_url: p.github_repo_url,
    }));

    return NextResponse.json(result);
  }
);
