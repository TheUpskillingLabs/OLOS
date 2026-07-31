/* The canonical cycle-window registry — the ONE definition of the six
   member cycle actions (task-management consolidation).

   The dates themselves stay where they've always been: admins set the six
   *_open/*_close pairs in cycle_config (admin schedule form), and
   syncPhasesFromConfig mirrors them into cycle_phases (lib/cycles/
   schedule.ts). This module owns only the STATIC metadata that was
   previously copy-pasted in six files with three different label sets:
   keys, labels, routes, ordering, and which columns/phase each window
   reads.

   Two label registers, used verbatim everywhere (owner consistency
   decision, task consolidation 2026-07):
     - labels.short  → timeline/phase contexts (the phase rail, the
       Poderator phase header)
     - labels.action → every actionable or status surface (dashboard task
       cards AND the cycle-page window rows — identical strings on both)

   resolveWindowStates is the single member-facing read model for "which
   windows are open/upcoming". It byte-matches checkWindow's decision
   procedure (lib/auth/windows.ts — phases-first [starts_at, ends_at),
   legacy pair fallback [open, close] inclusive) so a member can never see
   "open" on a card and get a 403 from the write gate at the same instant.

   Pure module: no Supabase import — client components (the phase
   indicator) import it directly. */

import { parseWindow } from "@/lib/cycles/lab-time";
import type { PhaseKey } from "@/lib/cycles/schedule";

export type WindowKey =
  | "problem_statement"
  | "voting"
  | "pod_registration"
  | "solution_proposal"
  | "solution_voting"
  | "project_registration";

export interface CycleWindowDef {
  /** = the cycle_config column stem = checkWindow's field name. */
  key: WindowKey;
  /** The cycle_phases row this window gates on (pod_registration maps onto
      pod_forming — the pod-registration.md two-window split). */
  phaseKey: PhaseKey;
  /** Display/sequence order, 1–6. */
  position: 1 | 2 | 3 | 4 | 5 | 6;
  openField: `${WindowKey}_open`;
  closeField: `${WindowKey}_close`;
  /** Sub-route under /cycles/{id}/ the window's action lives at. */
  route: string;
  labels: {
    /** Timeline register — the rail + Poderator phase header. */
    short: string;
    /** Action register — dashboard task cards AND cycle-page rows. */
    action: string;
  };
  /** CTA verb for the dashboard task card. */
  taskCta: string;
  /** The write gate's "not open" message (lib/auth/windows.ts). */
  closedMessage: string;
}

export const CYCLE_WINDOWS: readonly CycleWindowDef[] = [
  {
    key: "problem_statement",
    phaseKey: "problem_statement",
    position: 1,
    openField: "problem_statement_open",
    closeField: "problem_statement_close",
    route: "propose",
    labels: { short: "Problem Situations", action: "Submit a problem situation" },
    taskCta: "Propose",
    closedMessage: "Problem statement submission is not currently open.",
  },
  {
    key: "voting",
    phaseKey: "voting",
    position: 2,
    openField: "voting_open",
    closeField: "voting_close",
    route: "vote",
    labels: { short: "Voting", action: "Vote on problem situations" },
    taskCta: "Vote",
    closedMessage: "Voting is not currently open.",
  },
  {
    key: "pod_registration",
    phaseKey: "pod_forming",
    position: 3,
    openField: "pod_registration_open",
    closeField: "pod_registration_close",
    route: "register-pods",
    labels: { short: "Pod Registration", action: "Register for a pod" },
    taskCta: "Choose pod",
    closedMessage: "Pod registration is not currently open.",
  },
  {
    key: "solution_proposal",
    phaseKey: "solution_proposal",
    position: 4,
    openField: "solution_proposal_open",
    closeField: "solution_proposal_close",
    route: "solutions",
    labels: { short: "Solution Proposals", action: "Submit your solution proposal" },
    taskCta: "Propose",
    closedMessage: "Solution proposal submission is not currently open.",
  },
  {
    key: "solution_voting",
    phaseKey: "solution_voting",
    position: 5,
    openField: "solution_voting_open",
    closeField: "solution_voting_close",
    route: "solution-vote",
    labels: { short: "Solution Voting", action: "Cast your solution ballot" },
    taskCta: "Vote",
    closedMessage: "Solution voting is not currently open.",
  },
  {
    key: "project_registration",
    phaseKey: "project_registration",
    position: 6,
    openField: "project_registration_open",
    closeField: "project_registration_close",
    route: "register-projects",
    labels: { short: "Project Registration", action: "Register for a project" },
    taskCta: "Register",
    closedMessage: "Project registration is not currently open.",
  },
];

export function windowDef(key: WindowKey): CycleWindowDef {
  // The registry is a closed set; a miss is a programmer error.
  return CYCLE_WINDOWS.find((w) => w.key === key) as CycleWindowDef;
}

/* ── The member-facing read model ───────────────────────────────────── */

export interface WindowPhaseRow {
  phase_key: string;
  starts_at: string;
  ends_at: string;
}

export interface WindowState {
  key: WindowKey;
  open: boolean;
  /** The window's bounds as stored (naive-UTC strings) — null when the
      window isn't scheduled at all. */
  opensAt: string | null;
  closesAt: string | null;
}

/**
 * Which windows are open right now, and each window's bounds — resolved the
 * exact way checkWindow authorizes writes: a cycle_phases row wins when one
 * exists for the window's phaseKey ([starts_at, ends_at) — close exclusive),
 * else the legacy cycle_config pair ([open, close] — close INCLUSIVE, the
 * windowOpen contract). The per-source inclusivity difference is deliberate
 * and test-pinned; do not "unify" it without changing checkWindow in the
 * same commit.
 */
export function resolveWindowStates(
  phases: WindowPhaseRow[] | null,
  config: Record<string, string | null> | null,
  now: Date
): WindowState[] {
  return CYCLE_WINDOWS.map((w) => {
    const phase = phases?.find((p) => p.phase_key === w.phaseKey) ?? null;
    if (phase) {
      const starts = parseWindow(phase.starts_at);
      const ends = parseWindow(phase.ends_at);
      const open = !!starts && !!ends && now >= starts && now < ends;
      return { key: w.key, open, opensAt: phase.starts_at, closesAt: phase.ends_at };
    }
    const openVal = config?.[w.openField] ?? null;
    const closeVal = config?.[w.closeField] ?? null;
    const o = parseWindow(openVal);
    const c = parseWindow(closeVal);
    const open = !!o && !!c && now >= o && now <= c;
    return { key: w.key, open, opensAt: openVal, closesAt: closeVal };
  });
}

/** The next window that hasn't opened yet (by its own open bound), or null —
    the rail's neutral "Up next: … opens {date}" chip. */
export function nextUpcomingWindow(
  states: WindowState[],
  now: Date
): WindowState | null {
  let next: WindowState | null = null;
  let nextMs = Infinity;
  for (const s of states) {
    const o = parseWindow(s.opensAt);
    if (!o) continue;
    const ms = o.getTime();
    if (ms > now.getTime() && ms < nextMs) {
      next = s;
      nextMs = ms;
    }
  }
  return next;
}
