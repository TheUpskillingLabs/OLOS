import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/app/components/ui";
import {
  cycleStatusVariant,
  cycleStatusLabel,
  isPastCycle,
} from "@/lib/cycles/status";
import { getRegistrationCycle } from "@/lib/cycles/registration";
import CyclePhaseIndicator from "./cycle-phase-indicator";

export default async function CyclesPage() {
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, slug, start_date, end_date, status")
    .order("start_date", { ascending: false });

  const activeCycle = cycles?.find((c) => c.status === "active") ?? null;

  // The cycle currently open for registration (may be `upcoming`) — featured
  // for new members. Distinct from the active cycle.
  const registrationCycle = await getRegistrationCycle(serviceClient);
  const showRegistrationHero =
    !!registrationCycle && registrationCycle.id !== activeCycle?.id;

  // Config powers the active cycle's phase timeline.
  let activeCycleConfig = null;
  if (activeCycle) {
    const { data } = await serviceClient
      .from("cycle_config")
      .select(
        "phase_2_start, phase_3_start, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
      )
      .eq("cycle_id", activeCycle.id)
      .single();
    activeCycleConfig = data;
  }

  const featuredIds = new Set(
    [activeCycle?.id, showRegistrationHero ? registrationCycle?.id : undefined].filter(
      (id): id is number => typeof id === "number"
    )
  );
  const remaining = (cycles ?? []).filter((c) => !featuredIds.has(c.id));
  const pastCycles = remaining.filter((c) => isPastCycle(c.status));
  const upcomingCycles = remaining.filter(
    (c) => !isPastCycle(c.status) && c.status !== "draft"
  );

  return (
    <div>
      {/* Featured: register for the open cycle (the hero for new members) */}
      {showRegistrationHero && registrationCycle && (
        <Link
          href={`/cycles/${registrationCycle.id}/join`}
          className="group mb-8 block rounded-card border border-teal/40 bg-teal/10 p-6 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div className="lbl lbl-teal mb-2">Registration open</div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="t-h2 text-ink">{registrationCycle.name}</h2>
              <p className="mt-1 text-sm text-meta">
                Starts{" "}
                {new Date(registrationCycle.start_date).toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" }
                )}
              </p>
            </div>
            <span className="btn btn-teal btn-sm flex-shrink-0">
              Register
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </div>
        </Link>
      )}

      {/* Phase timeline for the active cycle */}
      {activeCycle && activeCycleConfig && (
        <CyclePhaseIndicator cycle={activeCycle} config={activeCycleConfig} />
      )}

      {/* Pulse Check CTA — always-on requirement while a cycle is active */}
      {activeCycle && (
        <Link
          href="/pulse-check"
          className="group mb-4 flex items-center justify-between rounded-card border border-ink/10 border-l-4 border-l-red bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 flex-shrink-0 text-red" aria-hidden />
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
            <h2 className="t-h3 text-ink">{activeCycle.name}</h2>
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

      {/* Upcoming cycles (not the featured registration cycle) */}
      {upcomingCycles.length > 0 && (
        <CycleGrid heading="Upcoming cycles" cycles={upcomingCycles} />
      )}

      {/* Past cycles — genuinely finished only */}
      {pastCycles.length > 0 && (
        <CycleGrid
          heading={activeCycle || showRegistrationHero ? "Past cycles" : "Build cycles"}
          cycles={pastCycles}
        />
      )}

      {(!cycles || cycles.length === 0) && (
        <p className="text-meta">No cycles yet.</p>
      )}
    </div>
  );
}

function CycleGrid({
  heading,
  cycles,
}: {
  heading: string;
  cycles: Array<{
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    status: string;
  }>;
}) {
  return (
    <div className="mb-8">
      <h2 className="lbl mb-4">{heading}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cycles.map((cycle) => (
          <Link
            key={cycle.id}
            href={`/cycles/${cycle.id}`}
            className="rounded-card border border-ink/10 bg-white p-6 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="t-h4 text-ink">{cycle.name}</h3>
              <StatusBadge variant={cycleStatusVariant(cycle.status)}>
                {cycleStatusLabel(cycle.status)}
              </StatusBadge>
            </div>
            <p className="mt-2 text-sm text-meta">
              {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
              {new Date(cycle.end_date).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
