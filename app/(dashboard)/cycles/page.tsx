import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/app/components/ui";
import { one } from "@/lib/supabase/embed";
import { getCycleWeek } from "@/lib/cycle/week";
import { isOperatingCycle } from "@/lib/cycle/active";
import { formatMonthDay } from "@/lib/format/date";
import {
  openWindows,
  nextWindow,
  type CycleWindowKey,
} from "@/lib/cycle/windows";
import { CYCLE_PHASES, phaseForWeek } from "@/lib/cycle/phases";
import CyclePhaseIndicator from "./cycle-phase-indicator";
import CycleCommitments from "../dashboard/cycle-commitments";

/* The "My Cycle" hub — the nav destination for the member's Build Cycle.
   One page instead of the old list→detail hop (the single-HQ-cycle model
   means the list had exactly one live item): the running cycle renders here
   directly with the member's OWN state — what's open now and whether they've
   done it, their pod, what each phase means, their committed dates — with
   the org track, the recruiting cohort, and the archive below. Past and org
   cycles keep their detail page at /cycles/[id]; the active participant
   cycle redirects from there to here. */

export const metadata = {
  title: "My Cycle · The Upskilling Labs",
  description: "Where your Build Cycle stands and what's open for you now.",
};

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

/* Per-window personal status lines. `done` is the ✓ register; `pending` the
   nudge. Pod/project lines get the member's own pod/project name spliced in
   at render time. */
const WINDOW_STATUS: Record<
  CycleWindowKey,
  { done: string; pending: string }
> = {
  problem_statement: {
    done: "Your statement is in — you can edit it until the window closes.",
    pending: "You haven't submitted a statement yet.",
  },
  voting: {
    done: "Your ballot is cast.",
    pending: "You haven't voted yet.",
  },
  pod_registration: {
    done: "You're in.",
    pending: "You haven't chosen a pod yet.",
  },
  solution_proposal: {
    done: "Your proposal is in — you can edit it until the window closes.",
    pending: "You haven't submitted a proposal yet.",
  },
  solution_voting: {
    done: "Your ballot is cast.",
    pending: "You haven't voted yet.",
  },
  project_registration: {
    done: "You're registered.",
    pending: "You haven't registered for a project yet.",
  },
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
      ? serviceClient
          .from("participants")
          .select("id, metro_id")
          .eq("auth_user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

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

  const activeCycle = cycles.find(isOperatingCycle) ?? null;

  // ── The other tracks: org, recruiting, archive ─────────────────────
  const otherCycles = cycles.filter((c) => c.id !== activeCycle?.id);
  // Org cycles run alongside the participant track and get their own section
  // (invite-only — never a "Register" CTA), so the active/upcoming ones are
  // excluded from the generic upcoming/past lists below.
  const orgCycles = otherCycles.filter((c) => c.mode === "org");
  const activeOrgCycle = orgCycles.find((c) => c.status === "active") ?? null;
  const upcomingOrgCycle =
    orgCycles.find((c) => c.status === "upcoming") ?? null;
  // An upcoming (non-org) cohort is open for registration — surface it as
  // its own "Register" section, never buried under the archive.
  const upcomingCycles = otherCycles.filter(
    (c) => c.mode !== "org" && c.status === "upcoming"
  );
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

  // ── The member's own state in the active cycle ─────────────────────
  const participantId = me?.id ?? null;
  let activeCycleConfig = null;
  let enrolled = false;
  let orgActive = false;
  type PodMembership = {
    id: number;
    pod_id: number;
    pods: { id: number; name: string; status: string };
  };
  let myPods: PodMembership[] = [];
  let myProjectName: string | null = null;
  let windowDone: Record<CycleWindowKey, boolean> = {
    problem_statement: false,
    voting: false,
    pod_registration: false,
    solution_proposal: false,
    solution_voting: false,
    project_registration: false,
  };

  if (activeCycle) {
    const none = Promise.resolve({ data: null, count: 0 });
    // Pass 1 — orientation: the window config, the member's enrollment, and
    // their org-cycle enrollment (which gates the join card below the same
    // way the dashboard's owner-ratified carve-out does).
    const [configResult, enrollmentResult, orgEnrollmentResult] =
      await Promise.all([
        serviceClient
          .from("cycle_config")
          .select(
            "phase_2_start, phase_3_start, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
          )
          .eq("cycle_id", activeCycle.id)
          .single(),
        participantId
          ? serviceClient
              .from("cycle_enrollments")
              .select("id, status")
              .eq("participant_id", participantId)
              .eq("cycle_id", activeCycle.id)
              .maybeSingle()
          : none,
        participantId && activeOrgCycle
          ? serviceClient
              .from("cycle_enrollments")
              .select("id, status")
              .eq("participant_id", participantId)
              .eq("cycle_id", activeOrgCycle.id)
              .maybeSingle()
          : none,
      ]);
    activeCycleConfig = configResult.data;
    enrolled = !!enrollmentResult.data;
    orgActive =
      (orgEnrollmentResult.data as { status?: string } | null)?.status ===
      "active";

    // Pass 2 — the six per-window personal-state queries, only for members
    // engaged with this cycle (nothing below renders them otherwise).
    if (enrolled && participantId) {
      const mine = (table: string, idColumn: string) =>
        serviceClient
          .from(table)
          .select("id", { head: true, count: "exact" })
          .eq(idColumn, participantId)
          .eq("cycle_id", activeCycle.id);
      const [
        podsResult,
        statementResult,
        voteResult,
        proposalResult,
        solutionVoteResult,
        projectResult,
      ] = await Promise.all([
        serviceClient
          .from("pod_memberships")
          .select("id, pod_id, pods!inner(id, name, status)")
          .eq("participant_id", participantId)
          .eq("pods.cycle_id", activeCycle.id)
          .is("inactive_at", null),
        mine("problem_statements", "participant_id"),
        mine("votes", "voter_id"),
        mine("solution_proposals", "participant_id"),
        mine("project_votes", "voter_id"),
        serviceClient
          .from("project_memberships")
          .select("id, projects(id, name)")
          .eq("participant_id", participantId)
          .eq("cycle_id", activeCycle.id)
          .is("left_at", null)
          .limit(1)
          .maybeSingle(),
      ]);
      myPods = (podsResult.data as unknown as PodMembership[]) ?? [];
      const myProject = projectResult.data as {
        projects:
          | { id: number; name: string }
          | { id: number; name: string }[]
          | null;
      } | null;
      // `|| null` so a blank name falls through to the generic done copy.
      myProjectName = myProject ? (one(myProject.projects)?.name || null) : null;
      windowDone = {
        problem_statement: (statementResult.count ?? 0) > 0,
        voting: (voteResult.count ?? 0) > 0,
        pod_registration: myPods.length > 0,
        solution_proposal: (proposalResult.count ?? 0) > 0,
        solution_voting: (solutionVoteResult.count ?? 0) > 0,
        // Keyed off the membership ROW, not the project's name —
        // projects.name has no NOT NULL/CHECK, and a blank name must not
        // read as "not registered".
        project_registration: !!myProject,
      };
    }
  }

  const now = new Date();
  const activeWindows = activeCycleConfig
    ? openWindows(activeCycleConfig, now)
    : [];
  const upcomingWindow = activeCycleConfig
    ? nextWindow(activeCycleConfig, now)
    : null;
  const currentPhaseNum = activeCycle
    ? phaseForWeek(
        getCycleWeek(
          now,
          new Date(activeCycle.start_date),
          new Date(activeCycle.end_date)
        )
      )
    : 0;

  // Per-window status line, with the member's own pod/project name where we
  // have one.
  const statusLine = (key: CycleWindowKey): string => {
    if (!windowDone[key]) return WINDOW_STATUS[key].pending;
    if (key === "pod_registration" && myPods.length > 0) {
      return `You're in ${myPods.map((m) => m.pods.name || `Pod ${m.pod_id}`).join(", ")}.`;
    }
    if (key === "project_registration" && myProjectName) {
      return `You're on ${myProjectName}.`;
    }
    return WINDOW_STATUS[key].done;
  };

  return (
    <div>
      {/* ── Page header — the destination the nav names ─────────────── */}
      <div className="mb-8">
        <h1 className="t-h1 text-ink">My Cycle</h1>
        {activeCycle && (
          <p className="mt-1 flex flex-wrap items-center gap-3 text-sm text-meta">
            <span className="font-semibold text-charcoal">
              {activeCycle.name}
            </span>
            <span className="tabular-nums">
              {new Date(activeCycle.start_date).toLocaleDateString()} &ndash;{" "}
              {new Date(activeCycle.end_date).toLocaleDateString()}
            </span>
          </p>
        )}
      </div>

      {/* ── Phase timeline — the whole journey at a glance ──────────── */}
      {activeCycle && activeCycleConfig && (
        <CyclePhaseIndicator
          cycle={activeCycle}
          config={activeCycleConfig}
          showWindows={false}
        />
      )}

      {/* ── Not enrolled but a cycle is running: the way in. Org-active
          staff are exempt — the participant-cohort join CTA is for the
          pipeline they're deliberately not in (the dashboard's carve-out;
          their work shows under "Organization cycle" below). ───────── */}
      {activeCycle && me && !enrolled && !orgActive && (
        <Link
          href={`/cycles/${activeCycle.id}/join`}
          className="group mb-8 flex items-center justify-between rounded-card border border-teal/30 bg-teal/10 p-6 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div>
            <h2 className="t-h3 text-ink">You&apos;re not in this cycle yet</h2>
            <p className="mt-1 text-sm text-meta">
              Join {activeCycle.name} to take on a real problem with a pod —
              here&apos;s the whole three-month arc above.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-teal-deep">
            Join the cycle
            <ArrowRight
              className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      )}

      {/* ── Open now — each open window with YOUR state in it ───────── */}
      {activeCycle && enrolled && (activeWindows.length > 0 || upcomingWindow) && (
        <section className="mb-8">
          {activeWindows.length > 0 && (
            <>
              <h2 className="lbl mb-4">Open now</h2>
              <div className="space-y-3">
                {activeWindows.map((w) => {
                  const done = windowDone[w.key];
                  return (
                    <Link
                      key={w.key}
                      href={`/cycles/${activeCycle.id}/${w.route}`}
                      className={`group flex items-center justify-between gap-3 rounded-card border p-4 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${
                        done
                          ? "border-ink/10 bg-white shadow-card hover:border-ink/20"
                          : "border-teal/30 bg-teal/10 hover:border-teal"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {done ? (
                          <span
                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-teal/15"
                            aria-hidden
                          >
                            <Check className="h-3.5 w-3.5 text-teal-deep" />
                          </span>
                        ) : (
                          <span
                            className="relative flex h-2 w-2 flex-shrink-0"
                            aria-hidden
                          >
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                          </span>
                        )}
                        <div>
                          <span className="font-semibold tracking-tight text-ink">
                            {w.action}
                          </span>
                          <p className="mt-0.5 text-sm text-meta">
                            {statusLine(w.key)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2 text-sm text-slate">
                        <span className="tabular-nums">
                          closes {formatMonthDay(w.closesAt)}
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold tracking-tight text-teal-deep">
                          {done ? "View" : w.cta}
                          <ArrowRight
                            className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
          {upcomingWindow && (
            <p
              className={`text-sm text-meta ${activeWindows.length > 0 ? "mt-3" : ""}`}
            >
              Up next: {upcomingWindow.noun.toLowerCase()} opens{" "}
              {formatMonthDay(upcomingWindow.opensAt)}.
            </p>
          )}
        </section>
      )}

      {/* ── Your pod — your people in this cycle, front and center ──── */}
      {enrolled && myPods.length > 0 && (
        <section className="mb-8">
          <h2 className="lbl mb-4">
            {myPods.length === 1 ? "Your pod" : "Your pods"}
          </h2>
          <div
            className={
              myPods.length === 1 ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"
            }
          >
            {myPods.map((membership) => {
              const pod = membership.pods;
              const variant =
                pod.status === "active"
                  ? "active"
                  : pod.status === "forming"
                    ? "forming"
                    : "inactive";
              return (
                <Link
                  key={membership.id}
                  href={`/pods/${pod.id}`}
                  className="group flex items-center justify-between gap-3 rounded-card border border-ink/10 bg-white p-5 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <div className="flex items-center gap-3">
                    <h3 className="t-h4 text-ink">
                      {pod.name || `Pod ${pod.id}`}
                    </h3>
                    <StatusBadge variant={variant}>{pod.status}</StatusBadge>
                  </div>
                  <ArrowRight
                    className="h-4 w-4 flex-shrink-0 text-teal-deep transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ── What each phase means — meaning, not just timing ────────── */}
      {activeCycle && (
        <section className="mb-8">
          <h2 className="lbl mb-4">The three months</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {CYCLE_PHASES.map((p) => {
              const current = currentPhaseNum === p.num;
              return (
                <div
                  key={p.num}
                  className={`rounded-card border bg-white p-5 shadow-card ${
                    current ? "border-teal/40" : "border-ink/10"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`text-[11px] font-medium uppercase tracking-wider ${
                        current ? "text-teal-deep" : "text-meta-soft"
                      }`}
                    >
                      Month {p.num} &middot; Weeks {p.weeks}
                    </p>
                    {current && (
                      <StatusBadge variant="active">now</StatusBadge>
                    )}
                  </div>
                  <h3 className="t-h4 mt-2 text-ink">{p.title}</h3>
                  <p className="mt-2 text-sm text-meta">{p.blurb}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Your commitments — the dated anchor events + .ics ───────── */}
      {enrolled && (
        <div className="mb-8">
          <CycleCommitments />
        </div>
      )}

      {/* ── No participant cycle running ────────────────────────────── */}
      {!activeCycle && upcomingCycles.length === 0 && cycles.length > 0 && (
        <p className="mb-8 text-meta">
          No cycle is running right now — the next Build Cycle will show up
          here.
        </p>
      )}

      {/* Organization cycle — the workstream track running alongside the
          participant cycle. Plain white card styling keeps the member's own
          sections above as the visual lead. */}
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
            {upcomingCycles.map((cycle) => (
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
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-teal-deep">
                  Register
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* ── The archive — collapsed; low-frequency by design ────────── */}
      {pastCycles.length > 0 && (
        <details className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
          <summary className="lbl cursor-pointer hover:text-charcoal">
            Past cycles
          </summary>
          <div className="mt-4 autogrid">
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
                    <h3 className="t-h4 text-ink">{cycle.name}</h3>
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
        </details>
      )}

      {cycles.length === 0 && <p className="text-meta">No cycles yet.</p>}
    </div>
  );
}
