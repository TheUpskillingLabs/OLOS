import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import WindowStateCard from "@/app/components/cycle/window-state-card";
import SolutionBallot from "./solution-ballot";

export default async function SolutionVotePage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id, 10);
  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name, status")
    .eq("id", cycleId)
    .single();

  if (!cycle) notFound();

  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select(
      "solution_voting_open, solution_voting_close, project_submitter_votes"
    )
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const openAt = config?.solution_voting_open ? new Date(config.solution_voting_open) : null;
  const closeAt = config?.solution_voting_close ? new Date(config.solution_voting_close) : null;
  const isOpen = openAt !== null && closeAt !== null && now >= openAt && now <= closeAt;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let myPods: { id: number; name: string | null }[] = [];
  let hasSubmitted = false;
  let hasVoted = false;

  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (participant) {
      const { data: memberships } = await supabase
        .from("pod_memberships")
        .select("pod_id, pods!inner(id, name, cycle_id)")
        .eq("participant_id", participant.id)
        .eq("pods.cycle_id", cycleId)
        .is("inactive_at", null);

      myPods = (memberships || []).map((m) => {
        const pod = m.pods as unknown as { id: number; name: string | null };
        return { id: pod.id, name: pod.name };
      });

      // W2-001: only submitters can vote. Check across all pods this cycle —
      // the (cycle_id, participant_id) unique constraint added in 00016
      // guarantees at most one row.
      const { data: ownProposal } = await supabase
        .from("solution_proposals")
        .select("id")
        .eq("cycle_id", cycleId)
        .eq("participant_id", participant.id)
        .maybeSingle();
      hasSubmitted = !!ownProposal;

      // Already voted? Short-circuit to the confirmation so a returning voter
      // isn't told "ballot already submitted" only after re-allocating it.
      const { data: existingVote } = await supabase
        .from("project_votes")
        .select("id")
        .eq("cycle_id", cycleId)
        .eq("voter_id", participant.id)
        .limit(1)
        .maybeSingle();
      hasVoted = !!existingVote;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          Vote on projects
        </h1>
        <p className="mt-1 text-sm text-charcoal">
          Allocate your votes to the projects you want your pod to build. Submit
          your full ballot at once.
        </p>
      </div>

      {!isOpen ? (
        <WindowStateCard
          field="solution_voting"
          openAt={config?.solution_voting_open ?? null}
          closeAt={config?.solution_voting_close ?? null}
        />
      ) : myPods.length === 0 ? (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            You are not a member of any pods in this cycle.
          </p>
          <Link
            href={`/cycles/${cycle.id}`}
            className="mt-2 inline-block text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            View cycle &rarr;
          </Link>
        </div>
      ) : !hasSubmitted ? (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="font-semibold tracking-tight text-charcoal">
            Voting is underway.
          </p>
          <p className="mt-2 text-sm text-meta">
            You didn&apos;t submit a project, so you&apos;re not eligible to
            vote in this phase. You can still register for one of the
            shortlisted projects when registration opens.
          </p>
        </div>
      ) : hasVoted ? (
        <div className="rounded-card border border-teal/30 bg-teal/10 p-6 shadow-card">
          <p className="font-semibold tracking-tight text-ink">
            Your ballot is in.
          </p>
          <p className="mt-2 text-sm text-charcoal">
            You&apos;ve submitted your project votes for this cycle. Results are
            tallied when voting closes.
          </p>
        </div>
      ) : (
        <SolutionBallot
          pods={myPods}
          voteBudget={config?.project_submitter_votes ?? 0}
        />
      )}
    </div>
  );
}
