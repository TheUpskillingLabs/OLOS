import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";

// The tester's self-reset (the testing pathway, migration 00042): deletes
// EVERY journey row for this account — the participants row included — so
// the next sign-in walks the whole onboarding again (OAuth callback finds
// no row → /register → funnel → cycle ceremony → pods → logs). The
// email-keyed testers grant survives, and the funnel re-applies is_test
// on re-registration.
//
// Self-service and tester-only: the caller resets THEIR OWN account,
// nothing else — an admin who wants to reset someone flags them as a
// tester and lets them do it. Deliberately allowed to delete others'
// votes ON the tester's own submissions (FK requires it) — testers are
// test data by definition; that collateral is the point of the flag.
// This is the one sanctioned bulk-delete path in the app; every table
// here is otherwise append-only or reconciler-guarded.
export const POST = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const pid = auth.user.participantId;
    if (!pid) {
      return NextResponse.json({ error: "No participant record" }, { status: 403 });
    }

    const service = createServiceClient();
    const { data: me } = await service
      .from("participants")
      .select("id, is_test")
      .eq("id", pid)
      .maybeSingle();
    if (!me?.is_test) {
      return NextResponse.json(
        { error: "Not a tester account" },
        { status: 403 }
      );
    }

    // FK-safe order. CASCADE satellites (participant_options, user_roles,
    // participant_permissions, nominations, nudge_dismissals,
    // moderator_ui_state) go with the row delete at the end;
    // feedback.participant_id SET NULLs itself.
    const del = (table: string) => service.from(table).delete();

    // My shares reference my logs.
    await del("profile_updates").eq("participant_id", pid);
    await del("learning_logs").eq("participant_id", pid);
    await del("pulse_checks").eq("participant_id", pid);

    // Votes I cast, then votes others cast on MY submissions, then the
    // submissions themselves. Proposals that became projects stay (the
    // project FKs them; they're team property now).
    await del("votes").eq("voter_id", pid);
    await del("project_votes").eq("voter_id", pid);

    const { data: myStatements } = await service
      .from("problem_statements")
      .select("id")
      .eq("participant_id", pid);
    const statementIds = (myStatements ?? []).map((s) => s.id);
    if (statementIds.length > 0) {
      // Pods may anchor to my statement — testers shouldn't own live pods,
      // but if one does, keep that statement (FK) and delete the rest.
      const { data: anchored } = await service
        .from("pods")
        .select("problem_statement_id")
        .in("problem_statement_id", statementIds);
      const keep = new Set((anchored ?? []).map((a) => a.problem_statement_id));
      const deletable = statementIds.filter((id) => !keep.has(id));
      if (deletable.length > 0) {
        await del("votes").in("problem_statement_id", deletable);
        await del("problem_statements").in("id", deletable);
      }
    }

    const { data: myProposals } = await service
      .from("solution_proposals")
      .select("id")
      .eq("participant_id", pid);
    const proposalIds = (myProposals ?? []).map((s) => s.id);
    if (proposalIds.length > 0) {
      const { data: won } = await service
        .from("projects")
        .select("solution_proposal_id")
        .in("solution_proposal_id", proposalIds);
      const keep = new Set((won ?? []).map((w) => w.solution_proposal_id));
      const deletable = proposalIds.filter((id) => !keep.has(id));
      if (deletable.length > 0) {
        await del("project_votes").in("solution_proposal_id", deletable);
        await del("solution_proposals").in("id", deletable);
      }
    }

    // Memberships, assignments, agreements, enrollment, audit, public writes.
    await del("project_memberships").eq("participant_id", pid);
    await del("pod_memberships").eq("participant_id", pid);
    await del("moderator_assignments").eq("participant_id", pid);
    await del("cycle_agreements").eq("participant_id", pid);
    await del("access_revocations").eq("participant_id", pid);
    await del("cycle_enrollments").eq("participant_id", pid);
    await del("event_rsvps").eq("participant_id", pid);
    await del("metro_waitlist_signups").eq("participant_id", pid);

    // The row itself — next sign-in finds nothing and replays onboarding.
    const { error: rowError } = await service
      .from("participants")
      .delete()
      .eq("id", pid);
    if (rowError) {
      // A reference we didn't model (e.g. this tester granted roles or
      // sent invitations). Surface it honestly rather than half-deleting.
      return NextResponse.json(
        {
          error: `Journey data cleared, but the account row is still referenced (${rowError.message}). Ask an admin to finish the reset.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ reset: true });
  }
);
