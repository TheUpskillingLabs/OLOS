import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const { data: project, error } = await auth.supabase
      .from("projects")
      .select("id, name, solution_proposal_id, pod_id, cycle_id, status")
      .eq("id", projectId)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get config for min/max
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("project_min, project_max")
      .eq("cycle_id", project.cycle_id)
      .single();

    // Get registrants
    const { data: memberships } = await auth.supabase
      .from("project_memberships")
      .select(`
        participant_id, registered_at,
        participants (first_name, last_name, preferred_name)
      `)
      .eq("project_id", projectId)
      .is("left_at", null);

    const registrants = (memberships || []).map((m) => {
      const p = (m.participants as unknown) as Record<string, unknown>;
      return {
        participant_id: m.participant_id,
        name: `${p?.first_name || ""} ${p?.last_name || ""}`.trim(),
        registered_at: m.registered_at,
      };
    });

    // Get vote tally for this project's proposal
    const { data: votes } = await auth.supabase
      .from("project_votes")
      .select("vote_count")
      .eq("solution_proposal_id", project.solution_proposal_id);

    const totalVotes = (votes || []).reduce((sum, v) => sum + v.vote_count, 0);

    return NextResponse.json({
      ...project,
      total_votes: totalVotes,
      registrants,
      registrant_count: registrants.length,
      min_required: config?.project_min || 3,
      max_allowed: config?.project_max || 7,
    });
  }
);
