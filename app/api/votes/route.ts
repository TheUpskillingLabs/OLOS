import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { withAuth } from "@/lib/auth/middleware";
import { isEnrolledParticipant, isActiveParticipant } from "@/lib/auth/roles";
import { isCurrentlyRevoked } from "@/lib/enrollment/revocation";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { voteSchema, voteSetSchema } from "@/lib/validations/votes";
import { requireCompleteProfile } from "@/lib/participants/placeholder";
import { rejectOrgCycle } from "@/lib/cycle/guards";
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

    const orgRejection = await rejectOrgCycle(auth.supabase, cycle_id);
    if (orgRejection) return orgRejection;

    // Check window
    const window = await checkWindow(auth.supabase, cycle_id, "voting");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Enrolled (non-revoked) is the right gate for phases 1–2 — see
    // isEnrolledParticipant docs for why 'active' would deadlock here.
    if (!isEnrolledParticipant(auth.user, cycle_id)) {
      return NextResponse.json({ error: "You must be enrolled in this cycle" }, { status: 403 });
    }

    // Revoked participants also sit at status 'inactive' (the revocation
    // flow never writes 'revoked') — consult the access_revocations audit
    // trail so they can't vote.
    if (
      !isActiveParticipant(auth.user, cycle_id) &&
      (await isCurrentlyRevoked(voter_id, cycle_id))
    ) {
      return NextResponse.json(
        { error: "Your access to this cycle has been revoked." },
        { status: 403 }
      );
    }

    // Same-lab guard (docs/LOCAL_LABS.md): you may only vote on your own lab's
    // problem statements — the ballot already scopes to them, this is the
    // server-side twin. Also validates the statement belongs to this cycle.
    const { data: target } = await auth.supabase
      .from("problem_statements")
      .select("metro_id")
      .eq("id", problem_statement_id)
      .eq("cycle_id", cycle_id)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "Problem statement not found" }, { status: 404 });
    }
    const { data: voter } = await auth.supabase
      .from("participants")
      .select("metro_id")
      .eq("id", voter_id)
      .maybeSingle();
    if ((target.metro_id ?? null) !== (voter?.metro_id ?? null)) {
      return NextResponse.json(
        { error: "You can only vote on your own lab's problem statements" },
        { status: 403 }
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
      .select("id, problem_statement_id, vote_count")
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

    // Stacking: voters may add votes to a problem they already voted on.
    // UNIQUE(voter_id, problem_statement_id, cycle_id) means one row per
    // (voter, problem) — an existing row is incremented rather than
    // duplicated. votes has no UPDATE RLS policy (INSERT-only for members),
    // so the increment goes through the service client; every guard above
    // (window, enrollment, revocation, lab, budget) has already passed.
    const existingRow = (existingVotes || []).find(
      (v) => v.problem_statement_id === problem_statement_id
    );

    let data: { id: number; created_at: string };
    if (existingRow) {
      const { data: updated, error } = await createServiceClient()
        .from("votes")
        .update({ vote_count: existingRow.vote_count + vote_count })
        .eq("id", existingRow.id)
        .select("id, created_at")
        .single();
      if (error) {
        return dbError(error);
      }
      data = updated;
    } else {
      const { data: inserted, error } = await auth.supabase
        .from("votes")
        .insert({ cycle_id, voter_id, problem_statement_id, vote_count })
        .select("id, created_at")
        .single();
      if (error) {
        return dbError(error);
      }
      data = inserted;
    }

    return NextResponse.json(
      { ...data, votes_remaining: budget - totalAllocated - vote_count },
      { status: 201 }
    );
  }
);

// Set-absolute allocation: "set my votes on this statement to N" (N >= 0).
// One path covers add / increase / decrease / remove — the ballot's stepper +
// edit UI submits the desired total, not a delta. N = 0 deletes the row
// (votes stores one row per (voter, statement); zero-count rows aren't a
// supported state). Guard chain mirrors POST verbatim.
export const PUT = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, voteSetSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id, problem_statement_id, vote_count } = body;
    const voter_id = auth.user.participantId;

    if (!voter_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const guard = await requireCompleteProfile(auth.supabase, voter_id);
    if (guard) return guard;

    const orgRejection = await rejectOrgCycle(auth.supabase, cycle_id);
    if (orgRejection) return orgRejection;

    const window = await checkWindow(auth.supabase, cycle_id, "voting");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    if (!isEnrolledParticipant(auth.user, cycle_id)) {
      return NextResponse.json({ error: "You must be enrolled in this cycle" }, { status: 403 });
    }

    if (
      !isActiveParticipant(auth.user, cycle_id) &&
      (await isCurrentlyRevoked(voter_id, cycle_id))
    ) {
      return NextResponse.json(
        { error: "Your access to this cycle has been revoked." },
        { status: 403 }
      );
    }

    // Same-lab guard + validates the statement belongs to this cycle.
    const { data: target } = await auth.supabase
      .from("problem_statements")
      .select("metro_id")
      .eq("id", problem_statement_id)
      .eq("cycle_id", cycle_id)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "Problem statement not found" }, { status: 404 });
    }
    const { data: voter } = await auth.supabase
      .from("participants")
      .select("metro_id")
      .eq("id", voter_id)
      .maybeSingle();
    if ((target.metro_id ?? null) !== (voter?.metro_id ?? null)) {
      return NextResponse.json(
        { error: "You can only vote on your own lab's problem statements" },
        { status: 403 }
      );
    }

    // Budget
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

    const { data: existingVotes } = await auth.supabase
      .from("votes")
      .select("id, problem_statement_id, vote_count")
      .eq("cycle_id", cycle_id)
      .eq("voter_id", voter_id);

    const existingRow = (existingVotes || []).find(
      (v) => v.problem_statement_id === problem_statement_id
    );

    // Votes allocated to *other* statements — the new total for this statement
    // is checked against the budget net of those, so lowering or removing this
    // statement's allocation always frees budget.
    const allocatedElsewhere = (existingVotes || []).reduce(
      (sum, v) => (v.problem_statement_id === problem_statement_id ? sum : sum + v.vote_count),
      0
    );

    if (allocatedElsewhere + vote_count > budget) {
      return NextResponse.json(
        {
          error: `Vote budget exceeded. Budget: ${budget}, allocated elsewhere: ${allocatedElsewhere}, requested: ${vote_count}`,
        },
        { status: 400 }
      );
    }

    // votes has no UPDATE/DELETE RLS policy (INSERT-only for members), so
    // updates and deletes go through the service client; every guard above has
    // already passed. New rows still insert via the RLS-scoped client so the
    // votes_insert WITH CHECK (voter_id = current_participant_id()) applies.
    if (vote_count === 0) {
      if (existingRow) {
        const { error } = await createServiceClient()
          .from("votes")
          .delete()
          .eq("id", existingRow.id);
        if (error) return dbError(error);
      }
    } else if (existingRow) {
      const { error } = await createServiceClient()
        .from("votes")
        .update({ vote_count })
        .eq("id", existingRow.id);
      if (error) return dbError(error);
    } else {
      const { error } = await auth.supabase
        .from("votes")
        .insert({ cycle_id, voter_id, problem_statement_id, vote_count });
      if (error) return dbError(error);
    }

    return NextResponse.json({
      vote_count,
      votes_remaining: budget - allocatedElsewhere - vote_count,
    });
  }
);
