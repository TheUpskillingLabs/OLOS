import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/app/components/ui";
import CyclePhaseIndicator from "./cycle-phase-indicator";

type CycleStatus = "active" | "closed" | "draft";

const STATUS_VARIANT: Record<CycleStatus, "active" | "inactive" | "draft"> = {
  active: "active",
  closed: "inactive",
  draft: "draft",
};

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
          className="group mb-4 flex items-center justify-between rounded-md border border-yellow-500/20 bg-yellow-500/[0.04] p-4 transition-colors duration-150 ease-out hover:border-yellow-500/40 hover:bg-yellow-500/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          <div className="flex items-center gap-3">
            <Activity
              className="h-5 w-5 flex-shrink-0 text-yellow-300"
              aria-hidden
            />
            <div>
              <span className="font-semibold tracking-tight text-white">
                Weekly pulse check
              </span>
              <p className="text-sm text-cloud/60">
                Stay active &mdash; complete your check-in to keep access to
                cycle tools.
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-yellow-300 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}

      {/* Active cycle quick-link */}
      {activeCycle && (
        <Link
          href={`/cycles/${activeCycle.id}`}
          className="group mb-8 flex items-center justify-between rounded-md border border-teal/20 bg-teal/[0.04] p-5 transition-colors duration-150 ease-out hover:border-teal/40 hover:bg-teal/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              {activeCycle.name}
            </h2>
            <p className="mt-0.5 text-sm text-cloud/60">
              {new Date(activeCycle.start_date).toLocaleDateString()} &ndash;{" "}
              {new Date(activeCycle.end_date).toLocaleDateString()}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-aqua">
            View cycle
            <ArrowRight
              className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      )}

      {/* Past / other cycles */}
      {otherCycles.length > 0 && (
        <>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-cloud/60">
            {activeCycle ? "Past cycles" : "Build cycles"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCycles.map((cycle) => {
              const variant =
                STATUS_VARIANT[cycle.status as CycleStatus] ?? "inactive";
              return (
                <Link
                  key={cycle.id}
                  href={`/cycles/${cycle.id}`}
                  className="rounded-md border border-whisper bg-white/[0.02] p-6 transition-colors duration-150 ease-out hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-white">
                      {cycle.name}
                    </h3>
                    <StatusBadge variant={variant}>{cycle.status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-cloud/60">
                    {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                    {new Date(cycle.end_date).toLocaleDateString()}
                  </p>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {(!cycles || cycles.length === 0) && (
        <p className="text-cloud/60">No cycles yet.</p>
      )}
    </div>
  );
}
