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
          className="group mb-4 flex items-center justify-between rounded-card border border-ink/10 border-l-4 border-l-red bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-3">
            <Activity
              className="h-5 w-5 flex-shrink-0 text-red"
              aria-hidden
            />
            <div>
              <span className="font-semibold tracking-tight text-ink">
                Weekly pulse check
              </span>
              <p className="text-sm text-meta">
                Stay active &mdash; complete your check-in to keep access to
                cycle tools.
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-red transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}

      {/* Active cycle quick-link */}
      {activeCycle && (
        <Link
          href={`/cycles/${activeCycle.id}`}
          className="group mb-8 flex items-center justify-between rounded-card border border-teal/30 bg-teal/10 p-5 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div>
            <h2 className="t-h3 text-ink">
              {activeCycle.name}
            </h2>
            <p className="mt-0.5 text-sm text-meta">
              {new Date(activeCycle.start_date).toLocaleDateString()} &ndash;{" "}
              {new Date(activeCycle.end_date).toLocaleDateString()}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-teal-deep">
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
          <h2 className="lbl mb-4">
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
                  className="rounded-card border border-ink/10 bg-white p-6 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="t-h4 text-ink">
                      {cycle.name}
                    </h3>
                    <StatusBadge variant={variant}>{cycle.status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-meta">
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
        <p className="text-meta">No cycles yet.</p>
      )}
    </div>
  );
}
