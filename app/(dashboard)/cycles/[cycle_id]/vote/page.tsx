import Link from "next/link";
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

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="text-sm text-cloud/60 hover:text-aqua"
        >
          &larr; {cycle.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          Vote on Problem Statements
        </h1>
        <p className="mt-1 text-sm text-cloud/50">
          Allocate your votes to the problems you want the community to tackle.
        </p>
      </div>

      {isOpen ? (
        <VoteBallot
          cycleId={cycleId}
          submitterBudget={config?.submitter_votes ?? 0}
          nonSubmitterBudget={config?.non_submitter_votes ?? 0}
        />
      ) : (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/60">Voting is not currently open.</p>
          {config?.voting_open && now < new Date(config.voting_open) && (
            <p className="mt-2 text-sm text-cloud/40">
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
