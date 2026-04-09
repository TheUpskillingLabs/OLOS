import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { checkWindow } from "@/lib/auth/windows";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);

    const { data: votes, error } = await auth.supabase
      .from("project_votes")
      .select("solution_proposal_id, vote_count, voter_id")
      .eq("pod_id", podId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate tallies
    const tallyMap: Record<number, number> = {};
    for (const v of votes || []) {
      tallyMap[v.solution_proposal_id] =
        (tallyMap[v.solution_proposal_id] || 0) + v.vote_count;
    }

    const tallies = Object.entries(tallyMap)
      .map(([id, total]) => ({
        solution_proposal_id: parseInt(id),
        total_votes: total,
      }))
      .sort((a, b) => b.total_votes - a.total_votes);

    const result: Record<string, unknown> = { tallies };

    if (isAdmin(auth.user) || isModeratorForPod(auth.user, podId)) {
      result.votes = votes;
    }

    return NextResponse.json(result);
  }
);

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);
    const voterId = auth.user.participantId;
    const body = await request.json();
    const { solution_proposal_id, vote_count } = body;

    if (!voterId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    if (!solution_proposal_id || !vote_count || vote_count < 1) {
      return NextResponse.json(
        { error: "solution_proposal_id and vote_count (>= 1) are required" },
        { status: 400 }
      );
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

    // Check window
    const window = await checkWindow(auth.supabase, pod.cycle_id, "solution_voting");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Check active pod membership
    const { data: membership } = await auth.supabase
      .from("pod_memberships")
      .select("id")
      .eq("pod_id", podId)
      .eq("participant_id", voterId)
      .is("inactive_at", null)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "You must be an active member of this pod" },
        { status: 403 }
      );
    }

    // Verify proposal belongs to this pod
    const { data: proposal } = await auth.supabase
      .from("solution_proposals")
      .select("id")
      .eq("id", solution_proposal_id)
      .eq("pod_id", podId)
      .maybeSingle();

    if (!proposal) {
      return NextResponse.json(
        { error: "Solution proposal not found in this pod" },
        { status: 400 }
      );
    }

    // Check budget
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("project_submitter_votes")
      .eq("cycle_id", pod.cycle_id)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 500 });
    }

    const { data: existingVotes } = await auth.supabase
      .from("project_votes")
      .select("vote_count")
      .eq("pod_id", podId)
      .eq("voter_id", voterId);

    const totalAllocated = (existingVotes || []).reduce(
      (sum, v) => sum + v.vote_count,
      0
    );

    if (totalAllocated + vote_count > config.project_submitter_votes) {
      return NextResponse.json(
        {
          error: `Vote budget exceeded. Budget: ${config.project_submitter_votes}, already allocated: ${totalAllocated}, requested: ${vote_count}`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("project_votes")
      .insert({
        cycle_id: pod.cycle_id,
        pod_id: podId,
        voter_id: voterId,
        solution_proposal_id,
        vote_count,
      })
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ...data,
        votes_remaining: config.project_submitter_votes - totalAllocated - vote_count,
      },
      { status: 201 }
    );
  }
);
