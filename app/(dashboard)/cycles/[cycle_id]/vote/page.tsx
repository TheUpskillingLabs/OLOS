import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
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

  // The voter's budget depends on whether they submitted a problem statement
  // this cycle. Resolve it server-side so the ballot shows the correct
  // remaining count on first paint (and after a reload), not just after the
  // first cast.
  let isSubmitter = false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();
    if (participant) {
      const { data: submission } = await serviceClient
        .from("problem_statements")
        .select("id")
        .eq("cycle_id", cycleId)
        .eq("participant_id", participant.id)
        .limit(1)
        .maybeSingle();
      isSubmitter = !!submission;
    }
  }

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
          submitterBudget={config?.submitter_votes ?? 0}
          nonSubmitterBudget={config?.non_submitter_votes ?? 0}
          isSubmitter={isSubmitter}
        />
      ) : (
        <div className="rounded-card border border-ink/10 bg-white p-6 text-center shadow-card">
          <p className="text-charcoal">Voting is not currently open.</p>
          {config?.voting_open && now < new Date(config.voting_open) && (
            <p className="mt-2 text-sm text-meta tabular-nums">
              Opens{" "}
              {new Date(config.voting_open).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
