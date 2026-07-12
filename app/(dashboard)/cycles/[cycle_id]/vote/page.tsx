import Link from "next/link";
import { windowOpen, parseWindow, fmtLabDateTime } from "@/lib/cycles/lab-time";
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

  // Check if window is open. maybeSingle: a cycle without a cycle_config row
  // must degrade to the explicit "not configured" message, not a query error.
  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select("voting_open, voting_close, submitter_votes, non_submitter_votes")
    .eq("cycle_id", cycleId)
    .maybeSingle();

  // Naive window columns are UTC instants; entry + display are lab-local
  // (lib/cycles/lab-time.ts).
  const now = new Date();
  const isOpen = windowOpen(config?.voting_open, config?.voting_close, now);

  // Whether the viewer submitted a proposal in this cycle decides their vote
  // budget (cycle_config.submitter_votes vs non_submitter_votes). The API
  // (app/api/votes/route.ts) makes the same determination when a vote is
  // cast; resolving it here too lets the ballot show the right budget from
  // the first render instead of defaulting to the non-submitter value.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isSubmitter = false;
  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (participant) {
      const { data: submission } = await supabase
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
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
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
          isSubmitter={isSubmitter}
          submitterBudget={config?.submitter_votes ?? 0}
          nonSubmitterBudget={config?.non_submitter_votes ?? 0}
        />
      ) : (
        <div className="rounded-card border border-ink/10 bg-white p-6 shadow-card">
          <p className="text-charcoal">
            {config
              ? "Voting is not currently open."
              : "This cycle isn't fully configured yet — the voting window hasn't been scheduled. If you expected it to be open, let an organizer know."}
          </p>
          {config?.voting_open &&
            now < (parseWindow(config.voting_open) as Date) && (
              <p className="mt-2 text-sm text-meta tabular-nums">
                Opens {fmtLabDateTime(config.voting_open)}
              </p>
            )}
        </div>
      )}
    </div>
  );
}
