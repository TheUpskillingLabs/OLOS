import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { projectBallotSchema } from "@/lib/validations/pods";
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

    // Per-voter attribution is admin-only; moderators see tallies only.
    // The W2-001 moderator dashboard intentionally omits voter-level data.
    if (isAdmin(auth.user) || isModeratorForPod(auth.user, podId)) {
      result.ballot_count = new Set((votes || []).map((v) => v.voter_id)).size;
    }
    if (isAdmin(auth.user)) {
      result.votes = votes;
    }

    return NextResponse.json(result);
  }
);

// Atomic ballot submission — W2-001 (#74). The voter sends their entire
// ballot at once (one entry per shortlisted proposal, including zero-vote
// entries from the UI). Server enforces:
//   * voting window open
//   * voter is an active member of this pod
//   * voter has submitted a proposal in this cycle (submitter-only voting)
//   * voter has not previously submitted a ballot for this pod (idempotent)
//   * sum of vote_count equals cycle_config.project_submitter_votes
//   * every solution_proposal_id belongs to this pod
//
// Not wrapped in an explicit transaction — Supabase JS doesn't expose one
// here. The (voter_id, solution_proposal_id, pod_id) unique constraint
// backstops the existence check if two requests race. Given the voting
// window is days long and one participant only submits their own ballot,
// the race window is effectively zero.
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

    const body = await parseBody(request, projectBallotSchema);
    if (isErrorResponse(body)) return body;
    const { votes } = body;

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
        { error: "Only participants who submitted a project can vote." },
        { status: 403 }
      );
    }

    // Idempotency — reject if voter already cast any votes in this pod.
    const { data: existingVotes } = await auth.supabase
      .from("project_votes")
      .select("id")
      .eq("pod_id", podId)
      .eq("voter_id", voterId)
      .limit(1);

    if (existingVotes && existingVotes.length > 0) {
      return NextResponse.json(
        { error: "You have already submitted your ballot for this pod." },
        { status: 409 }
      );
    }

    // Budget check
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("project_submitter_votes")
      .eq("cycle_id", pod.cycle_id)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 500 });
    }

    const sum = votes.reduce((s, v) => s + v.vote_count, 0);
    if (sum !== config.project_submitter_votes) {
      return NextResponse.json(
        {
          error: `Allocate exactly ${config.project_submitter_votes} vote${config.project_submitter_votes === 1 ? "" : "s"}. You submitted ${sum}.`,
        },
        { status: 400 }
      );
    }

    // Validate every proposal_id belongs to this pod.
    const proposalIds = votes.map((v) => v.solution_proposal_id);
    const { data: proposalsInPod } = await auth.supabase
      .from("solution_proposals")
      .select("id")
      .eq("pod_id", podId)
      .in("id", proposalIds.length ? proposalIds : [0]);

    const validIds = new Set((proposalsInPod || []).map((p) => p.id));
    if (proposalIds.some((id) => !validIds.has(id))) {
      return NextResponse.json(
        { error: "Ballot includes proposals not in this pod." },
        { status: 400 }
      );
    }

    const rowsToInsert = votes
      .filter((v) => v.vote_count > 0)
      .map((v) => ({
        cycle_id: pod.cycle_id,
        pod_id: podId,
        voter_id: voterId,
        solution_proposal_id: v.solution_proposal_id,
        vote_count: v.vote_count,
      }));

    if (rowsToInsert.length === 0) {
      return NextResponse.json(
        { error: "Ballot must allocate at least one vote." },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("project_votes")
      .insert(rowsToInsert)
      .select("id");

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(
      { inserted: data?.length ?? 0, votes_remaining: 0 },
      { status: 201 }
    );
  }
);
