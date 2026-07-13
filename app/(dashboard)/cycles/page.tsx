import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fmtLabDateTime } from "@/lib/cycles/lab-time";
import {
  registrationWindow,
  type RegistrationWindow,
} from "@/lib/cycles/schedule";
import { StatusBadge } from "@/app/components/ui";
import CyclePhaseIndicator from "./cycle-phase-indicator";

type CycleStatus = "active" | "upcoming" | "closed" | "draft";

const STATUS_VARIANT: Record<
  CycleStatus,
  "active" | "forming" | "inactive" | "draft"
> = {
  active: "active",
  upcoming: "forming", // anticipatory (teal), never the grey "inactive" fallback
  closed: "inactive",
  draft: "draft",
};

export default async function CyclesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const serviceClient = createServiceClient();

  const [{ data: allCycles }, { data: me }] = await Promise.all([
    supabase
      .from("cycles")
      .select("id, name, slug, start_date, end_date, status, mode, lab_id")
      .order("start_date", { ascending: false }),
    user
      ? supabase
          .from("participants")
          .select("id, metro_id")
          .eq("auth_user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Cycles the viewer already registered for (signed the agreement) — the
  // "Open for registration" card must not show a bare "Register" CTA for a
  // cycle they're already in (July 2026 feedback). Same lookup the join
  // ceremony uses to open on the confirmation.
  const registeredCycleIds = new Set<number>();
  if (me?.id) {
    const { data: agreements } = await serviceClient
      .from("cycle_agreements")
      .select("cycle_id")
      .eq("participant_id", me.id);
    for (const a of agreements ?? []) registeredCycleIds.add(a.cycle_id);
  }

  // Local Labs are sub-cohorts of the single HQ participant cycle
  // (docs/LOCAL_LABS.md, 00067): every member sees the HQ open cycle —
  // their metro selects their pod inside it, not their cycle. Org cycles
  // stay lab-scoped: a member sees HQ's org cycle plus their own lab's,
  // never another lab's internal cycle.
  const memberLabId: number | null = me?.metro_id ?? null;
  const cycles = (allCycles ?? []).filter(
    (c) =>
      c.lab_id === null || (c.mode === "org" && c.lab_id === memberLabId)
  );

  // Fetch config for the active cycle to power the phase indicator — the
  // single HQ open cycle.
  const activeCycle =
    cycles.find(
      (c) => c.status === "active" && c.mode === "open" && c.lab_id === null
    ) ?? null;
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

  const otherCycles = cycles?.filter((c) => c.id !== activeCycle?.id) ?? [];
  // Org cycles run alongside the participant track and get their own section
  // (invite-only — never a "Register" CTA), so the active/upcoming ones are
  // excluded from the generic upcoming/past lists below.
  const orgCycles = otherCycles.filter((c) => c.mode === "org");
  const activeOrgCycle = orgCycles.find((c) => c.status === "active") ?? null;
  const upcomingOrgCycle =
    orgCycles.find((c) => c.status === "upcoming") ?? null;
  // An upcoming (non-org) cohort is open for registration — surface it as
  // its own "Register" section, never buried under "Past cycles".
  const upcomingCycles = otherCycles.filter(
    (c) => c.mode !== "org" && c.status === "upcoming"
  );

  // D-10 (docs/requirements/pod-registration.md): cycle registration closes
  // between pod-forming close and the active-join window, then again after
  // active-join ends — the CTA must say so instead of "Register". At most a
  // cohort or two is upcoming at once, so per-cycle lookups are fine.
  const regWindows = new Map<number, RegistrationWindow>();
  for (const c of upcomingCycles) {
    regWindows.set(c.id, await registrationWindow(serviceClient, c.id));
  }
  // Everything else, in the query's original start_date-descending order —
  // a single filter over `otherCycles` rather than two mode-partitioned
  // filters concatenated, so an archived org cycle sorts alongside past
  // participant cycles instead of always trailing after them.
  const pastCycles = otherCycles.filter((c) => {
    if (c.id === activeOrgCycle?.id || c.id === upcomingOrgCycle?.id) {
      return false;
    }
    return !(c.mode !== "org" && c.status === "upcoming");
  });

  return (
    <div>
      {/* Phase timeline — the hero of the page */}
      {activeCycle && activeCycleConfig && (
        <CyclePhaseIndicator cycle={activeCycle} config={activeCycleConfig} />
      )}

      {/* Learning Log — the weekly practice, framed calmly (it replaced the pulse check) */}
      {activeCycle && (
        <Link
          href="/dashboard#learning-log"
          className="group mb-4 flex items-center justify-between rounded-card border border-ink/10 border-l-4 border-l-teal bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-3">
            <BookOpen
              className="h-5 w-5 flex-shrink-0 text-teal-deep"
              aria-hidden
            />
            <div>
              <span className="font-semibold tracking-tight text-ink">
                Your weekly Learning Log
              </span>
              <p className="text-sm text-meta">
                A few lines on what you&apos;re figuring out &mdash; that&apos;s
                the check-in.
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-teal-deep transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
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

      {/* Organization cycle — the workstream track running alongside the
          participant cycle. Plain white card styling keeps the participant
          active-cycle card above as the visual hero. */}
      {(activeOrgCycle || upcomingOrgCycle) && (
        <div className="mb-8">
          <h2 className="lbl mb-4">Organization cycle</h2>
          {activeOrgCycle && (
            <Link
              href={`/cycles/${activeOrgCycle.id}`}
              className="group mb-3 flex items-center justify-between rounded-card border border-ink/10 bg-white p-5 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <div>
                <h3 className="t-h3 text-ink">{activeOrgCycle.name}</h3>
                <p className="mt-0.5 text-sm text-meta">
                  {new Date(activeOrgCycle.start_date).toLocaleDateString()}{" "}
                  &ndash;{" "}
                  {new Date(activeOrgCycle.end_date).toLocaleDateString()}
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
          {upcomingOrgCycle && (
            <Link
              href={`/cycles/${upcomingOrgCycle.id}`}
              className="flex items-center justify-between rounded-card border border-ink/10 bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <div>
                <h3 className="t-h4 text-ink">{upcomingOrgCycle.name}</h3>
                <p className="mt-1 text-sm text-meta">
                  Starts{" "}
                  {new Date(upcomingOrgCycle.start_date).toLocaleDateString()}
                </p>
              </div>
              <StatusBadge variant={STATUS_VARIANT.upcoming}>
                {upcomingOrgCycle.status}
              </StatusBadge>
            </Link>
          )}
        </div>
      )}

      {/* Upcoming — open for registration. The CTA goes to the registration
          ceremony (/join), not the read-only info view. */}
      {upcomingCycles.length > 0 && (
        <>
          <h2 className="lbl mb-4">Open for registration</h2>
          <div className="mb-8 autogrid">
            {upcomingCycles.map((cycle) => {
              const w = regWindows.get(cycle.id);
              const regClosed = !registeredCycleIds.has(cycle.id) && w && !w.open;
              const cta = registeredCycleIds.has(cycle.id)
                ? "You’re registered — view details"
                : !regClosed
                  ? "Register"
                  : w?.state === "dead_zone" && w.reopensAt
                    ? `Registration reopens ${fmtLabDateTime(w.reopensAt.toISOString())}`
                    : "Registration closed";
              return (
                <Link
                  key={cycle.id}
                  href={`/cycles/${cycle.id}/join`}
                  className="group rounded-card border border-teal/30 bg-teal/10 p-6 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="t-h4 text-ink">{cycle.name}</h3>
                    <StatusBadge variant={STATUS_VARIANT.upcoming}>
                      {cycle.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-meta">
                    Starts {new Date(cycle.start_date).toLocaleDateString()}
                  </p>
                  <span
                    className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight ${
                      regClosed ? "text-meta" : "text-teal-deep"
                    }`}
                  >
                    {cta}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Past / other cycles — closed, archived, draft (never upcoming) */}
      {pastCycles.length > 0 && (
        <>
          <h2 className="lbl mb-4">
            {activeCycle || upcomingCycles.length > 0
              ? "Past cycles"
              : "Build cycles"}
          </h2>
          <div className="autogrid">
            {pastCycles.map((cycle) => {
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
