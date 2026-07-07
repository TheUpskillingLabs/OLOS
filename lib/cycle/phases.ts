/**
 * Canonical cycle-phase model — the single source for the six operational
 * windows (cycle_config open/close pairs) that drive "what action is live now."
 *
 * Folds together the definitions that were duplicated across the cycle detail
 * page (WINDOW_ROUTES), the dashboard (WINDOW_TODOS), the phase indicator
 * (OPERATIONAL_WINDOWS), lib/auth/windows.ts (WindowField), and the moderator
 * resolver (PHASES). `resolveCurrentPhase` lives here now; lib/moderator/phase.ts
 * re-exports it for its existing callers.
 *
 * Two orthogonal "phase" notions exist in the app: these operational windows,
 * and the 13-week calendar (lib/cycle/week.ts). This module owns the former.
 */

export type PhaseNum = 1 | 2 | 3 | 4 | 5 | 6;

export type WindowField =
  | "problem_statement"
  | "voting"
  | "pod_registration"
  | "solution_proposal"
  | "solution_voting"
  | "project_registration";

export interface CyclePhase {
  num: PhaseNum;
  /** cycle_config column prefix (e.g. "pod_registration"). */
  field: WindowField;
  /** Member-facing stage name for the journey (e.g. "Pod selection"). */
  label: string;
  /** Short name without the "Phase N:" prefix (moderator display; e.g. "Pod Registration"). */
  shortName: string;
  /** Imperative "Up next" title (e.g. "Register for a pod"). */
  action: string;
  /** Button label (e.g. "Choose pod"). */
  cta: string;
  /** Action route segment under /cycles/[id]/ (e.g. "register-pods"). */
  route: string;
}

export const CYCLE_PHASES: readonly CyclePhase[] = [
  { num: 1, field: "problem_statement",    label: "Problem statements",   shortName: "Problem Statements",   action: "Submit a problem statement",    cta: "Propose",    route: "propose" },
  { num: 2, field: "voting",               label: "Problem voting",       shortName: "Problem Voting",       action: "Vote on problem statements",    cta: "Vote",       route: "vote" },
  { num: 3, field: "pod_registration",     label: "Pod selection",        shortName: "Pod Registration",     action: "Register for a pod",            cta: "Choose pod", route: "register-pods" },
  { num: 4, field: "solution_proposal",    label: "Solution proposals",   shortName: "Solution Proposals",   action: "Submit your solution proposal", cta: "Propose",    route: "solutions" },
  { num: 5, field: "solution_voting",      label: "Solution voting",      shortName: "Solution Voting",      action: "Cast your solution ballot",     cta: "Vote",       route: "solution-vote" },
  { num: 6, field: "project_registration", label: "Project registration", shortName: "Project Registration", action: "Register for a project",        cta: "Register",   route: "register-projects" },
];

export interface CycleConfigPhaseColumns {
  problem_statement_open: string | null;
  problem_statement_close: string | null;
  voting_open: string | null;
  voting_close: string | null;
  pod_registration_open: string | null;
  pod_registration_close: string | null;
  solution_proposal_open: string | null;
  solution_proposal_close: string | null;
  solution_voting_open: string | null;
  solution_voting_close: string | null;
  project_registration_open: string | null;
  project_registration_close: string | null;
}

function readWindow(
  cfg: CycleConfigPhaseColumns,
  field: WindowField
): { openAt: string | null; closeAt: string | null } {
  const rec = cfg as unknown as Record<string, string | null>;
  return { openAt: rec[`${field}_open`] ?? null, closeAt: rec[`${field}_close`] ?? null };
}

// ── The moderator resolver (moved here; behaviour unchanged) ────────────────

export interface ResolvedPhase {
  num: PhaseNum;
  /** Canonical phase display name (e.g. "Phase 4: Solution Proposals"). */
  displayName: string;
  /** Short name without the "Phase N:" prefix (e.g. "Solution Proposals"). */
  shortName: string;
  openAt: string | null;
  closeAt: string | null;
  /** True when `now` is between openAt and closeAt (the phase is live). */
  isActive: boolean;
}

function toResolved(
  p: CyclePhase,
  openAt: string | null,
  closeAt: string | null,
  isActive: boolean
): ResolvedPhase {
  return {
    num: p.num,
    displayName: `Phase ${p.num}: ${p.shortName}`,
    shortName: p.shortName,
    openAt,
    closeAt,
    isActive,
  };
}

/**
 * Resolve the current phase. Returns the active phase if `now` is within an open
 * window; otherwise the nearest upcoming phase (so a header can render "Opens in
 * N days"); or null if every phase has closed (the cycle is over).
 */
export function resolveCurrentPhase(
  cfg: CycleConfigPhaseColumns,
  now: Date = new Date()
): ResolvedPhase | null {
  for (const p of CYCLE_PHASES) {
    const { openAt, closeAt } = readWindow(cfg, p.field);
    if (!openAt || !closeAt) continue;
    if (now >= new Date(openAt) && now <= new Date(closeAt)) {
      return toResolved(p, openAt, closeAt, true);
    }
  }

  let upcoming: ResolvedPhase | null = null;
  let upcomingOpenMs = Infinity;
  for (const p of CYCLE_PHASES) {
    const { openAt, closeAt } = readWindow(cfg, p.field);
    if (!openAt) continue;
    const openMs = new Date(openAt).getTime();
    if (openMs > now.getTime() && openMs < upcomingOpenMs) {
      upcoming = toResolved(p, openAt, closeAt, false);
      upcomingOpenMs = openMs;
    }
  }
  return upcoming;
}

// ── The dashboard timeline (per-phase state + current + next) ──────────────

export type PhaseState = "done" | "open" | "upcoming" | "unscheduled";

export interface TimelinePhase extends CyclePhase {
  state: PhaseState;
  openAt: string | null;
  closeAt: string | null;
}

export interface CycleTimeline {
  phases: TimelinePhase[];
  /** The phase whose window is open right now, if any. */
  current: TimelinePhase | null;
  /** The nearest phase whose window opens in the future, if any. */
  next: TimelinePhase | null;
}

/**
 * Classify every phase against `now` and surface the current-open and
 * next-upcoming phases. `unscheduled` = one or both timestamps are unset
 * (an admin hasn't scheduled that window yet).
 */
export function resolveCycleTimeline(
  cfg: CycleConfigPhaseColumns,
  now: Date = new Date()
): CycleTimeline {
  const nowMs = now.getTime();
  const phases: TimelinePhase[] = CYCLE_PHASES.map((p) => {
    const { openAt, closeAt } = readWindow(cfg, p.field);
    let state: PhaseState;
    if (!openAt || !closeAt) {
      state = "unscheduled";
    } else if (nowMs < new Date(openAt).getTime()) {
      state = "upcoming";
    } else if (nowMs <= new Date(closeAt).getTime()) {
      state = "open";
    } else {
      state = "done";
    }
    return { ...p, state, openAt, closeAt };
  });

  const current = phases.find((p) => p.state === "open") ?? null;
  const next =
    phases
      .filter((p) => p.state === "upcoming")
      .sort(
        (a, b) =>
          new Date(a.openAt as string).getTime() -
          new Date(b.openAt as string).getTime()
      )[0] ?? null;

  return { phases, current, next };
}
