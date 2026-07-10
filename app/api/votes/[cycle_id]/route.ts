import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    // Tallies — visible to all
    const { data: votes, error } = await auth.supabase
      .from("votes")
      .select("problem_statement_id, vote_count, voter_id")
      .eq("cycle_id", cycleId);

    if (error) {
      return dbError(error);
    }

    // Aggregate tallies
    const tallyMap: Record<number, number> = {};
    for (const v of votes || []) {
      tallyMap[v.problem_statement_id] =
        (tallyMap[v.problem_statement_id] || 0) + v.vote_count;
    }

    const tallies = Object.entries(tallyMap)
      .map(([id, total]) => ({
        problem_statement_id: parseInt(id, 10),
        total_votes: total,
      }))
      .sort((a, b) => b.total_votes - a.total_votes);

    const result: Record<string, unknown> = { tallies };

    // The caller's own allocations, so the ballot can render current votes and
    // support editing/withdrawing. A fact about oneself is not sensitive
    // (mirrors the has_voted self-disclosure in project-votes).
    if (auth.user.participantId) {
      result.my_votes = (votes || [])
        .filter((v) => v.voter_id === auth.user.participantId)
        .map((v) => ({
          problem_statement_id: v.problem_statement_id,
          vote_count: v.vote_count,
        }));
    }

    // Voter-level detail — admin only
    if (isAdmin(auth.user)) {
      result.votes = votes;
    }

    return NextResponse.json(result);
  }
);
