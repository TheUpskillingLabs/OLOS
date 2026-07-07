import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isActiveParticipant } from "@/lib/auth/roles";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { voteSchema } from "@/lib/validations/votes";
import { requireCompleteProfile } from "@/lib/participants/placeholder";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, voteSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id, problem_statement_id, vote_count } = body;
    const voter_id = auth.user.participantId;

    if (!voter_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const guard = await requireCompleteProfile(auth.supabase, voter_id);
    if (guard) return guard;

    // Check window
    const window = await checkWindow(auth.supabase, cycle_id, "voting");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    if (!isActiveParticipant(auth.user, cycle_id)) {
      return NextResponse.json({ error: "You must be an active participant" }, { status: 403 });
    }

    // The target statement must belong to THIS cycle. Only an FK to
    // problem_statements(id) exists, so without this a voter could inject
    // votes against another cycle's statement and pollute this cycle's tally
    // (audit fix: cross-cycle vote injection).
    const { data: targetStatement } = await auth.supabase
      .from("problem_statements")
      .select("cycle_id")
      .eq("id", problem_statement_id)
      .maybeSingle();

    if (!targetStatement || targetStatement.cycle_id !== cycle_id) {
      return NextResponse.json(
        { error: "That problem statement is not part of this cycle." },
        { status: 400 }
      );
    }

    // Determine budget
    const { data: submission } = await auth.supabase
      .from("problem_statements")
      .select("id")
      .eq("cycle_id", cycle_id)
      .eq("participant_id", voter_id)
      .limit(1)
      .maybeSingle();

    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("submitter_votes, non_submitter_votes")
      .eq("cycle_id", cycle_id)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 500 });
    }

    const budget = submission ? config.submitter_votes : config.non_submitter_votes;

    // Check total allocated votes
    const { data: existingVotes } = await auth.supabase
      .from("votes")
      .select("vote_count")
      .eq("cycle_id", cycle_id)
      .eq("voter_id", voter_id);

    const totalAllocated = (existingVotes || []).reduce(
      (sum, v) => sum + v.vote_count,
      0
    );

    if (totalAllocated + vote_count > budget) {
      return NextResponse.json(
        {
          error: `Vote budget exceeded. Budget: ${budget}, already allocated: ${totalAllocated}, requested: ${vote_count}`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("votes")
      .insert({ cycle_id, voter_id, problem_statement_id, vote_count })
      .select("id, created_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(
      { ...data, votes_remaining: budget - totalAllocated - vote_count },
      { status: 201 }
    );
  }
);
