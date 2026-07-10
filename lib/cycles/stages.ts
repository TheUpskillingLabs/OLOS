/**
 * Single source of truth for the six operational stages a participant moves
 * through in a cycle. Replaces the two hand-maintained arrays that had drifted
 * (WINDOW_ROUTES in cycles/[cycle_id]/page.tsx and OPERATIONAL_WINDOWS in
 * cycle-phase-indicator.tsx). Every wayfinding surface — the cycle detail CTAs,
 * the dashboard "what's live today" card, the phase indicator chips, and the
 * per-stage NextStepFooter — reads from here so they can never disagree.
 *
 * Stages are day-separated (each window opens on its own day), so the important
 * outputs are: which stage is OPEN right now, and when the NEXT one opens.
 */

export type StageKey =
  | "problem_statement"
  | "voting"
  | "pod_registration"
  | "solution_proposal"
  | "solution_voting"
  | "project_registration";

export type StageStatus = "past" | "open" | "upcoming";

export interface StageDef {
  key: StageKey;
  /** URL segment under /cycles/[id]/ */
  route: string;
  /** Short noun label for the stage, e.g. "Problem voting". */
  label: string;
  /** Verb CTA, e.g. "Vote on problem statements". */
  action: string;
}

export interface Stage extends StageDef {
  open: string | null;
  close: string | null;
  status: StageStatus;
}

/**
 * Ordered stage definitions. Naming reconciled so "project" only ever means the
 * shortlisted team (the register-projects stage). The solution stages say
 * "solution", not "project", to remove the overloaded term.
 */
export const STAGE_DEFS: readonly StageDef[] = [
  { key: "problem_statement", route: "propose", label: "Problem proposals", action: "Submit a problem statement" },
  { key: "voting", route: "vote", label: "Problem voting", action: "Vote on problem statements" },
  { key: "pod_registration", route: "register-pods", label: "Pod registration", action: "Choose your pods" },
  { key: "solution_proposal", route: "solutions", label: "Solution proposals", action: "Propose a solution" },
  { key: "solution_voting", route: "solution-vote", label: "Solution voting", action: "Vote on solutions" },
  { key: "project_registration", route: "register-projects", label: "Project registration", action: "Register for a project" },
] as const;

/** The subset of cycle_config columns this module reads. */
export type StageConfig = Partial<Record<`${StageKey}_open` | `${StageKey}_close`, string | null>>;

/** Comma-separated select list for the six stages' open/close columns. */
export const STAGE_CONFIG_COLUMNS = STAGE_DEFS.flatMap((s) => [
  `${s.key}_open`,
  `${s.key}_close`,
]).join(", ");

function statusOf(open: string | null, close: string | null, now: Date): StageStatus {
  if (open && new Date(open) > now) return "upcoming";
  if (close && new Date(close) < now) return "past";
  if (open && close && new Date(open) <= now && now <= new Date(close)) return "open";
  // open with no close, already started → treat as open; otherwise upcoming.
  if (open && new Date(open) <= now) return "open";
  return "upcoming";
}

/** Resolve every stage's window + status for a cycle at time `now`. */
export function resolveStages(config: StageConfig, now: Date = new Date()): Stage[] {
  return STAGE_DEFS.map((def) => {
    const open = config[`${def.key}_open`] ?? null;
    const close = config[`${def.key}_close`] ?? null;
    return { ...def, open, close, status: statusOf(open, close, now) };
  });
}

/** The currently-open stage, if any (first in order). */
export function currentStage(stages: Stage[]): Stage | null {
  return stages.find((s) => s.status === "open") ?? null;
}

/** The next stage that hasn't opened yet, if any (first in order). */
export function nextStage(stages: Stage[]): Stage | null {
  return stages.find((s) => s.status === "upcoming") ?? null;
}

/**
 * The stage immediately after `key` in the sequence, with its resolved status.
 * Used by the post-action NextStepFooter to point a finished user forward.
 */
export function stageAfter(stages: Stage[], key: StageKey): Stage | null {
  const idx = stages.findIndex((s) => s.key === key);
  if (idx === -1 || idx + 1 >= stages.length) return null;
  return stages[idx + 1];
}

/** Format an ISO date as e.g. "Tue, Mar 18". */
export function formatStageDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Whole days from `now` until `iso` (0 if past). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86_400_000));
}
