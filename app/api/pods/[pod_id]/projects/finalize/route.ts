import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { generateName } from "@/lib/llm/names";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    if (!isAdmin(auth.user) && !isModeratorForPod(auth.user, podId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get pod for cycle_id
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    // Get config
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("project_vote_threshold, max_projects")
      .eq("cycle_id", pod.cycle_id)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 500 });
    }

    // Tally votes
    const { data: votes } = await auth.supabase
      .from("project_votes")
      .select("solution_proposal_id, vote_count")
      .eq("pod_id", podId);

    const tallyMap: Record<number, number> = {};
    for (const v of votes || []) {
      tallyMap[v.solution_proposal_id] =
        (tallyMap[v.solution_proposal_id] || 0) + v.vote_count;
    }

    // Get proposals for text and tiebreaking
    const proposalIds = Object.keys(tallyMap).map(Number);
    const { data: proposals } = await auth.supabase
      .from("solution_proposals")
      .select("id, proposal_text, created_at")
      .in("id", proposalIds.length > 0 ? proposalIds : [0]);

    const propMap: Record<number, { text: string; createdAt: string }> = {};
    for (const p of proposals || []) {
      propMap[p.id] = { text: p.proposal_text, createdAt: p.created_at };
    }

    const ranked = Object.entries(tallyMap)
      .map(([id, total]) => ({
        solution_proposal_id: parseInt(id, 10),
        total_votes: total,
        created_at: propMap[parseInt(id, 10)]?.createdAt || "",
        text: propMap[parseInt(id, 10)]?.text || "",
      }))
      .sort((a, b) => {
        if (b.total_votes !== a.total_votes) return b.total_votes - a.total_votes;
        return a.created_at.localeCompare(b.created_at);
      });

    const eligible = ranked.filter(
      (r) => r.total_votes >= config.project_vote_threshold
    );
    const ineligible = ranked.filter(
      (r) => r.total_votes < config.project_vote_threshold
    );

    const toCreate = eligible.slice(0, config.max_projects);
    const projects = [];

    for (const prop of toCreate) {
      let name: string;
      try {
        name = await generateName("project", prop.text);
      } catch {
        name = prop.text.slice(0, 40).replace(/\s+\S*$/, "").trim();
      }

      const { data: project, error } = await auth.supabase
        .from("projects")
        .insert({
          cycle_id: pod.cycle_id,
          pod_id: podId,
          solution_proposal_id: prop.solution_proposal_id,
          name,
          status: "forming",
        })
        .select()
        .single();

      if (!error && project) {
        projects.push({
          id: project.id,
          name: project.name,
          solution_proposal_id: prop.solution_proposal_id,
          total_votes: prop.total_votes,
        });
      }
    }

    return NextResponse.json({
      projects,
      eligible_proposals: eligible.map((e, i) => ({
        solution_proposal_id: e.solution_proposal_id,
        total_votes: e.total_votes,
        rank: i + 1,
      })),
      ineligible_proposals: ineligible.map((e) => ({
        solution_proposal_id: e.solution_proposal_id,
        total_votes: e.total_votes,
      })),
    });
  }
);
