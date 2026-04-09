import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);

    const { data: pod, error } = await auth.supabase
      .from("pods")
      .select(`
        id, name, problem_statement_id, status, cycle_id,
        slack_channel_id, drive_folder_id, github_repo_url,
        problem_statements (statement_text)
      `)
      .eq("id", podId)
      .single();

    if (error || !pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const { count } = await auth.supabase
      .from("pod_memberships")
      .select("id", { count: "exact", head: true })
      .eq("pod_id", podId)
      .is("inactive_at", null);

    return NextResponse.json({
      ...pod,
      problem_statement_title: ((pod.problem_statements as unknown) as Record<string, string>)?.statement_text?.slice(0, 100),
      registrant_count: count || 0,
    });
  }
);
