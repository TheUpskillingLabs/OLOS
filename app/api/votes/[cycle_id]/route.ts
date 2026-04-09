import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseInt(params.cycle_id);

    // Tallies — visible to all
    const { data: votes, error } = await auth.supabase
      .from("votes")
      .select("problem_statement_id, vote_count, voter_id")
      .eq("cycle_id", cycleId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Aggregate tallies
    const tallyMap: Record<number, number> = {};
    for (const v of votes || []) {
      tallyMap[v.problem_statement_id] =
        (tallyMap[v.problem_statement_id] || 0) + v.vote_count;
    }

    const tallies = Object.entries(tallyMap)
      .map(([id, total]) => ({
        problem_statement_id: parseInt(id),
        total_votes: total,
      }))
      .sort((a, b) => b.total_votes - a.total_votes);

    const result: Record<string, unknown> = { tallies };

    // Voter-level detail — admin only
    if (isAdmin(auth.user)) {
      result.votes = votes;
    }

    return NextResponse.json(result);
  }
);
