import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProposeForm from "./propose-form";

export default async function ProposePage({
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
    .select("problem_statement_open, problem_statement_close")
    .eq("cycle_id", cycleId)
    .single();

  const now = new Date();
  const isOpen =
    config?.problem_statement_open &&
    config?.problem_statement_close &&
    now >= new Date(config.problem_statement_open) &&
    now <= new Date(config.problem_statement_close);

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
          Submit a Problem Statement
        </h1>
        <p className="mt-1 text-sm text-cloud/50">
          Propose a problem for the community to explore during this cycle.
        </p>
      </div>

      {isOpen ? (
        <ProposeForm cycleId={cycleId} />
      ) : (
        <div className="rounded-md border border-whisper bg-white/[0.02] p-6 text-center">
          <p className="text-cloud/60">
            Problem statement submission is not currently open.
          </p>
          {config?.problem_statement_open &&
            now < new Date(config.problem_statement_open) && (
              <p className="mt-2 text-sm text-cloud/40">
                Opens{" "}
                {new Date(config.problem_statement_open).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                )}
              </p>
            )}
        </div>
      )}
    </div>
  );
}
