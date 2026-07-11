/**
 * The six operational windows of a Build Cycle — the single source of truth
 * for their identity, member-facing wording, and open/closed math.
 *
 * Before this module, three surfaces each carried their own copy of this
 * table (the cycle detail page, the phase indicator, the dashboard's "Up
 * next") with three drifting label sets for the same action. Every surface
 * that names a window or asks "which windows are open right now?" derives it
 * from here, so wording and timing can never disagree again.
 *
 * Wording registers:
 *   - `noun`   — the short chip/timeline label ("Problem voting")
 *   - `action` — the imperative card title ("Vote on problem statements")
 *   - `cta`    — the button ("Vote")
 */

export type CycleWindowKey =
  | "problem_statement"
  | "voting"
  | "pod_registration"
  | "solution_proposal"
  | "solution_voting"
  | "project_registration";

export interface CycleWindowDef {
  key: CycleWindowKey;
  noun: string;
  action: string;
  cta: string;
  /** Sub-path under /cycles/[cycle_id]/ where the action lives. */
  route: string;
}

/** In cycle-chronological order — kickoff-side windows first. */
export const CYCLE_WINDOWS: readonly CycleWindowDef[] = [
  {
    key: "problem_statement",
    noun: "Problem statements",
    action: "Submit a problem statement",
    cta: "Propose",
    route: "propose",
  },
  {
    key: "voting",
    noun: "Problem voting",
    action: "Vote on problem statements",
    cta: "Vote",
    route: "vote",
  },
  {
    key: "pod_registration",
    noun: "Pod registration",
    action: "Register for a pod",
    cta: "Choose pod",
    route: "register-pods",
  },
  {
    key: "solution_proposal",
    noun: "Solution proposals",
    action: "Submit your solution proposal",
    cta: "Propose",
    route: "solutions",
  },
  {
    key: "solution_voting",
    noun: "Solution voting",
    action: "Vote on solutions",
    cta: "Vote",
    route: "solution-vote",
  },
  {
    key: "project_registration",
    noun: "Project registration",
    action: "Register for a project",
    cta: "Register",
    route: "register-projects",
  },
] as const;

/** The `cycle_config` timestamp pairs this module reads — structurally
    satisfied by any config row that carries the window columns. */
export type CycleWindowConfig = Partial<
  Record<`${CycleWindowKey}_open` | `${CycleWindowKey}_close`, string | null>
>;

export interface OpenCycleWindow extends CycleWindowDef {
  closesAt: string;
}

export interface UpcomingCycleWindow extends CycleWindowDef {
  opensAt: string;
}

/** The windows whose [open, close] interval contains `now`, in table order. */
export function openWindows(
  config: CycleWindowConfig,
  now: Date
): OpenCycleWindow[] {
  const open: OpenCycleWindow[] = [];
  for (const w of CYCLE_WINDOWS) {
    const opensAt = config[`${w.key}_open`];
    const closesAt = config[`${w.key}_close`];
    if (
      opensAt &&
      closesAt &&
      now >= new Date(opensAt) &&
      now <= new Date(closesAt)
    ) {
      open.push({ ...w, closesAt });
    }
  }
  return open;
}

/** The not-yet-open window with the earliest open time, or null when nothing
    is still ahead. Earliest-by-timestamp rather than first-in-table, so an
    admin who reorders windows in config still gets an honest "up next". */
export function nextWindow(
  config: CycleWindowConfig,
  now: Date
): UpcomingCycleWindow | null {
  let next: UpcomingCycleWindow | null = null;
  for (const w of CYCLE_WINDOWS) {
    const opensAt = config[`${w.key}_open`];
    if (!opensAt || new Date(opensAt) <= now) continue;
    if (!next || new Date(opensAt) < new Date(next.opensAt)) {
      next = { ...w, opensAt };
    }
  }
  return next;
}
