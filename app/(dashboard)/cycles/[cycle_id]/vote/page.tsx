import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import WindowStateCard from "@/app/components/cycle/window-state-card";
import VoteBallot from "./vote-ballot";

export default async function VotePage({
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

  // Check if window is open
  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select("voting_open, voting_close, submitter_votes, non_submitter_votes")
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const isOpen =
    config?.voting_open &&
    config?.voting_close &&
    now >= new Date(config.voting_open) &&
    now <= new Date(config.voting_close);

  // Resolve the member's real budget + votes already cast, so the ballot starts
  // correct (submitters get the larger budget) and survives a reload — the
  // client can't infer submitter status or prior spend on its own.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isSubmitter = false;
  let votesUsed = 0;
  if (user) {
    const { data: participant } = await serviceClient
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (participant) {
      const [{ data: ownStmt }, { data: myVotes }] = await Promise.all([
        serviceClient
          .from("problem_statements")
          .select("id")
          .eq("cycle_id", cycleId)
          .eq("participant_id", participant.id)
          .maybeSingle(),
        serviceClient
          .from("votes")
          .select("vote_count")
          .eq("cycle_id", cycleId)
          .eq("voter_id", participant.id),
      ]);
      isSubmitter = !!ownStmt;
      votesUsed = (myVotes ?? []).reduce(
        (sum, v) => sum + (v.vote_count ?? 0),
        0
      );
    }
  }
  const budget = isSubmitter
    ? config?.submitter_votes ?? 0
    : config?.non_submitter_votes ?? 0;

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          Vote on problem statements
        </h1>
        <p className="mt-1 text-sm text-charcoal">
          Allocate your votes to the problems you want the community to tackle.
        </p>
      </div>

      {isOpen ? (
        <VoteBallot
          cycleId={cycleId}
          budget={budget}
          votesUsed={votesUsed}
          submitterBudget={config?.submitter_votes ?? 0}
          nonSubmitterBudget={config?.non_submitter_votes ?? 0}
        />
      ) : (
        <WindowStateCard
          field="voting"
          openAt={config?.voting_open ?? null}
          closeAt={config?.voting_close ?? null}
        />
      )}
    </div>
  );
}
