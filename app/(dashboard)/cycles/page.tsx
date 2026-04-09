import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import CyclePhaseIndicator from "./cycle-phase-indicator";

export default async function CyclesPage() {
  const supabase = await createClient();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, slug, start_date, end_date, status")
    .order("start_date", { ascending: false });

  // Fetch config for the active cycle to power the phase indicator
  const activeCycle = cycles?.find((c) => c.status === "active") ?? null;
  let activeCycleConfig = null;
  if (activeCycle) {
    const serviceClient = createServiceClient();
    const { data } = await serviceClient
      .from("cycle_config")
      .select(
        "phase_2_start, phase_3_start, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
      )
      .eq("cycle_id", activeCycle.id)
      .single();
    activeCycleConfig = data;
  }

  const otherCycles = cycles?.filter((c) => c.id !== activeCycle?.id) ?? [];

  return (
    <div>
      {/* Phase timeline — the hero of the page */}
      {activeCycle && activeCycleConfig && (
        <CyclePhaseIndicator cycle={activeCycle} config={activeCycleConfig} />
      )}

      {/* Pulse Check CTA — always-on requirement */}
      {activeCycle && (
        <Link
          href="/pulse-check"
          className="mb-4 flex items-center justify-between rounded-md border border-yellow-500/20 bg-yellow-500/[0.04] p-4 transition-colors hover:border-yellow-500/40 hover:bg-yellow-500/[0.07]"
        >
          <div className="flex items-center gap-3">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            <div>
              <span className="font-medium text-white">Weekly Pulse Check</span>
              <p className="text-sm text-cloud/50">
                Stay active &mdash; complete your check-in to keep access to
                cycle tools
              </p>
            </div>
          </div>
          <span className="text-sm font-medium text-yellow-300">&rarr;</span>
        </Link>
      )}

      {/* Active cycle quick-link */}
      {activeCycle && (
        <Link
          href={`/cycles/${activeCycle.id}`}
          className="mb-8 flex items-center justify-between rounded-md border border-teal/20 bg-teal/[0.04] p-5 transition-colors hover:border-teal/40 hover:bg-teal/[0.07]"
        >
          <div>
            <h2 className="text-lg font-semibold text-white">
              {activeCycle.name}
            </h2>
            <p className="mt-0.5 text-sm text-cloud/50">
              {new Date(activeCycle.start_date).toLocaleDateString()} &ndash;{" "}
              {new Date(activeCycle.end_date).toLocaleDateString()}
            </p>
          </div>
          <span className="text-sm font-medium text-aqua">
            View cycle &rarr;
          </span>
        </Link>
      )}

      {/* Past / other cycles */}
      {otherCycles.length > 0 && (
        <>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-cloud/40">
            {activeCycle ? "Past Cycles" : "Build Cycles"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCycles.map((cycle) => (
              <Link
                key={cycle.id}
                href={`/cycles/${cycle.id}`}
                className="rounded-md border border-whisper bg-white/[0.02] p-6 transition-colors hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    {cycle.name}
                  </h3>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      cycle.status === "active"
                        ? "bg-teal/20 text-aqua"
                        : cycle.status === "closed"
                          ? "bg-white/10 text-cloud/60"
                          : "bg-yellow-500/20 text-yellow-300"
                    }`}
                  >
                    {cycle.status}
                  </span>
                </div>
                <p className="mt-2 text-sm text-cloud/60">
                  {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                  {new Date(cycle.end_date).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}

      {(!cycles || cycles.length === 0) && (
        <p className="text-cloud/60">No cycles yet.</p>
      )}
    </div>
  );
}
