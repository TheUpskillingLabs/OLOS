import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { isActiveParticipant } from "@/lib/auth/roles";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { voteSchema, voteDeleteSchema } from "@/lib/validations/votes";
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
      .select("cycle_id, participant_id")
      .eq("id", problem_statement_id)
      .maybeSingle();

    if (!targetStatement || targetStatement.cycle_id !== cycle_id) {
      return NextResponse.json(
        { error: "That problem statement is not part of this cycle." },
        { status: 400 }
      );
    }

    // Per-lab pool: in an HQ-open cycle (no cycle metro) each Local Lab votes
    // only within its own lab, so pods form per lab. The voter's lab must match
    // the statement author's lab. In a local-lab cycle everyone is one lab, so
    // no extra check is needed. The author's metro is read via the service
    // client because a voter can't read another participant's row under RLS.
    const { data: voteCycle } = await auth.supabase
      .from("cycles")
      .select("metro_slug")
      .eq("id", cycle_id)
      .maybeSingle();
    if (voteCycle && voteCycle.metro_slug === null) {
      const svc = createServiceClient();
      const { data: author } = await svc
        .from("participants")
        .select("metro_slug")
        .eq("id", targetStatement.participant_id)
        .maybeSingle();
      const statementLab = author?.metro_slug ?? null;
      const voterLab = auth.user.metroSlug;
      if (!voterLab || statementLab !== voterLab) {
        return NextResponse.json(
          { error: "You can only vote on problem statements from your own lab." },
          { status: 403 }
        );
      }
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

    // Check allocated votes. Exclude any existing allocation on THIS statement
    // so a re-allocation (upsert below) is measured against the OTHER
    // statements' spend rather than being double-counted against the budget.
    const { data: existingVotes } = await auth.supabase
      .from("votes")
      .select("problem_statement_id, vote_count")
      .eq("cycle_id", cycle_id)
      .eq("voter_id", voter_id);

    const totalOther = (existingVotes || [])
      .filter((v) => v.problem_statement_id !== problem_statement_id)
      .reduce((sum, v) => sum + v.vote_count, 0);

    if (totalOther + vote_count > budget) {
      return NextResponse.json(
        {
          error: `Vote budget exceeded. Budget: ${budget}, already allocated: ${totalOther}, requested: ${vote_count}`,
        },
        { status: 400 }
      );
    }

    // Upsert so a voter can change their allocation on a statement they already
    // voted on. Backed by UNIQUE(voter_id, problem_statement_id, cycle_id); the
    // votes_update RLS policy (migration 00035) permits the DO UPDATE path.
    const { data, error } = await auth.supabase
      .from("votes")
      .upsert(
        { cycle_id, voter_id, problem_statement_id, vote_count },
        { onConflict: "voter_id,problem_statement_id,cycle_id" }
      )
      .select("id, created_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(
      { ...data, votes_remaining: budget - totalOther - vote_count },
      { status: 201 }
    );
  }
);

// Withdraw a vote from a single statement. Deleting the row (rather than
// setting vote_count to 0) keeps the budget math simple — absence reads as
// zero — and is permitted by the votes_delete RLS policy (migration 00035).
export const DELETE = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, voteDeleteSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id, problem_statement_id } = body;
    const voter_id = auth.user.participantId;

    if (!voter_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Withdrawals are only allowed while voting is open, matching POST.
    const window = await checkWindow(auth.supabase, cycle_id, "voting");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    const { error } = await auth.supabase
      .from("votes")
      .delete()
      .eq("cycle_id", cycle_id)
      .eq("voter_id", voter_id)
      .eq("problem_statement_id", problem_statement_id);

    if (error) {
      return dbError(error);
    }

    return NextResponse.json({ success: true });
  }
);
