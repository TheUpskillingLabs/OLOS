import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import WindowStateCard from "@/app/components/cycle/window-state-card";
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

  // Get user's name for pre-filling
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let participantName = "";
  if (user) {
    const { data: participant } = await supabase
      .from("participants")
      .select("first_name, last_name, preferred_name")
      .eq("auth_user_id", user.id)
      .single();
    if (participant) {
      participantName =
        `${participant.preferred_name || participant.first_name || ""} ${participant.last_name || ""}`.trim();
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <Link
          href={`/cycles/${cycle.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {cycle.name}
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          Open cycle problem proposal
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-charcoal">
          The Open Cycle accepts problem proposals year-round. At the start of
          each cycle, active participants vote to shortlist the strongest
          proposals. Shortlisted proposals open for registration. If a research
          pod reaches the minimum number of registrants, it officially forms.
        </p>
        <p className="mt-2 text-sm font-medium text-charcoal">
          Take your time with Part 2 — it&rsquo;s the most important section.
          Everything else supports it.
        </p>
      </div>

      {isOpen ? (
        <ProposeForm cycleId={cycleId} participantName={participantName} />
      ) : (
        <WindowStateCard
          field="problem_statement"
          openAt={config?.problem_statement_open ?? null}
          closeAt={config?.problem_statement_close ?? null}
        />
      )}
    </div>
  );
}
