import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { projectVoteSchema, projectVoteDeleteSchema } from "@/lib/validations/pods";
import { requireCompleteProfile } from "@/lib/participants/placeholder";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const { data: votes, error } = await auth.supabase
      .from("project_votes")
      .select("solution_proposal_id, vote_count, voter_id")
      .eq("pod_id", podId);

    if (error) {
      return dbError(error);
    }

    const tallyMap: Record<number, number> = {};
    for (const v of votes || []) {
      tallyMap[v.solution_proposal_id] =
        (tallyMap[v.solution_proposal_id] || 0) + v.vote_count;
    }

    const tallies = Object.entries(tallyMap)
      .map(([id, total]) => ({
        solution_proposal_id: parseInt(id, 10),
        total_votes: total,
      }))
      .sort((a, b) => b.total_votes - a.total_votes);

    const result: Record<string, unknown> = { tallies };

    // The caller's own allocations, so the ballot can render current votes and
    // support editing/withdrawing (mirrors the pod-vote GET). A fact about
    // oneself isn't sensitive.
    if (auth.user.participantId) {
      result.my_votes = (votes || [])
        .filter((v) => v.voter_id === auth.user.participantId)
        .map((v) => ({
          solution_proposal_id: v.solution_proposal_id,
          vote_count: v.vote_count,
        }));
    }

    // Per-voter attribution is admin-only; moderators see tallies only.
    if (isAdmin(auth.user) || isModeratorForPod(auth.user, podId)) {
      result.ballot_count = new Set((votes || []).map((v) => v.voter_id)).size;
    }
    if (isAdmin(auth.user)) {
      result.votes = votes;
    }

    return NextResponse.json(result);
  }
);

// Cast or re-allocate a single project vote. Converged onto the pod-vote model
// (app/api/votes/route.ts): incremental per-proposal upsert with live tallies
// and edit/withdraw, replacing the old atomic all-budget ballot. Gates:
//   * solution_voting window open
//   * voter is an active member of this pod
//   * voter submitted a proposal in this cycle (submitter-only voting)
//   * running total (excluding this proposal's prior allocation) + new <= budget
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const voterId = auth.user.participantId;

    if (!voterId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const guard = await requireCompleteProfile(auth.supabase, voterId);
    if (guard) return guard;

    const body = await parseBody(request, projectVoteSchema);
    if (isErrorResponse(body)) return body;
    const { solution_proposal_id, vote_count } = body;

    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const window = await checkWindow(auth.supabase, pod.cycle_id, "solution_voting");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

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

    // Submitter gate — non-submitters cannot vote.
    const { data: ownProposal } = await auth.supabase
      .from("solution_proposals")
      .select("id")
      .eq("cycle_id", pod.cycle_id)
      .eq("participant_id", voterId)
      .maybeSingle();

    if (!ownProposal) {
      return NextResponse.json(
        { error: "Only participants who submitted a solution can vote." },
        { status: 403 }
      );
    }

    // Target proposal must belong to this pod.
    const { data: targetProposal } = await auth.supabase
      .from("solution_proposals")
      .select("id")
      .eq("id", solution_proposal_id)
      .eq("pod_id", podId)
      .maybeSingle();

    if (!targetProposal) {
      return NextResponse.json(
        { error: "That solution is not part of this pod." },
        { status: 400 }
      );
    }

    // Budget check — exclude any existing allocation on THIS proposal so a
    // re-allocation is measured against the other proposals' spend.
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
      .select("solution_proposal_id, vote_count")
      .eq("pod_id", podId)
      .eq("voter_id", voterId);

    const totalOther = (existingVotes || [])
      .filter((v) => v.solution_proposal_id !== solution_proposal_id)
      .reduce((sum, v) => sum + v.vote_count, 0);

    if (totalOther + vote_count > config.project_submitter_votes) {
      return NextResponse.json(
        {
          error: `Vote budget exceeded. Budget: ${config.project_submitter_votes}, already allocated: ${totalOther}, requested: ${vote_count}`,
        },
        { status: 400 }
      );
    }

    // Upsert on the (voter_id, solution_proposal_id, pod_id) unique constraint;
    // the project_votes_update policy (migration 00037) permits the DO UPDATE.
    const { data, error } = await auth.supabase
      .from("project_votes")
      .upsert(
        {
          cycle_id: pod.cycle_id,
          pod_id: podId,
          voter_id: voterId,
          solution_proposal_id,
          vote_count,
        },
        { onConflict: "voter_id,solution_proposal_id,pod_id" }
      )
      .select("id, created_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(
      {
        ...data,
        votes_remaining: config.project_submitter_votes - totalOther - vote_count,
      },
      { status: 201 }
    );
  }
);

// Withdraw a project vote from a single proposal (project_votes_delete policy,
// migration 00037). Deleting the row keeps the budget math simple.
export const DELETE = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const voterId = auth.user.participantId;

    if (!voterId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const body = await parseBody(request, projectVoteDeleteSchema);
    if (isErrorResponse(body)) return body;
    const { solution_proposal_id } = body;

    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const window = await checkWindow(auth.supabase, pod.cycle_id, "solution_voting");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    const { error } = await auth.supabase
      .from("project_votes")
      .delete()
      .eq("pod_id", podId)
      .eq("voter_id", voterId)
      .eq("solution_proposal_id", solution_proposal_id);

    if (error) {
      return dbError(error);
    }

    return NextResponse.json({ success: true });
  }
);
