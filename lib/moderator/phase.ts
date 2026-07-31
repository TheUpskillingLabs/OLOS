/**
 * Phase resolver for the poderator dashboard (PRD §7.1).
 *
 * Maps the current timestamp to one of the cycle's operational phases
 * using cycle_config window pairs. Six phases total — derived from the
 * canonical window registry (lib/cycles/windows.ts).
 *
 * The PRD glossary §5 mentions seven phases ("project shortlist" as a
 * seventh) but the schema and existing code recognize six operational
 * windows. We keep the six-phase model here as the source of truth and
 * file a follow-up to reconcile the PRD glossary.
 *
 * If `now` falls outside any open window, the resolver returns the
 * upcoming phase (if any) so the dashboard can render "opens in N days"
 * rather than an empty state. If the cycle is over, returns null.
 */

import { parseWindow } from "@/lib/cycles/lab-time";
import { CYCLE_WINDOWS } from "@/lib/cycles/windows";

export type PhaseNum = 1 | 2 | 3 | 4 | 5 | 6;

export interface ResolvedPhase {
  num: PhaseNum;
  /** Canonical phase display name (e.g. "Phase 4: Solution Proposals"). */
  displayName: string;
  /** Short name without the "Phase N:" prefix (e.g. "Solution Proposals"). */
  shortName: string;
  /** When the phase opened. Null when not scheduled (rare). */
  openAt: string | null;
  /** When the phase closes. Null when not scheduled (rare). */
  closeAt: string | null;
  /** True when `now` is between openAt and closeAt (the phase is live). */
  isActive: boolean;
}

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

interface PhaseSpec {
  num: PhaseNum;
  shortName: string;
  openKey: keyof CycleConfigPhaseColumns;
  closeKey: keyof CycleConfigPhaseColumns;
}

// Keys/positions come from the canonical window registry
// (lib/cycles/windows.ts). Two shortNames deliberately diverge from the
// registry's `labels.short` so the rendered Poderator header stays
// byte-identical to what shipped ("Problem Statements" / "Problem Voting"
// vs the member surfaces' "Problem Situations" / "Voting") — unifying that
// copy is a product call, not a refactor side effect.
const PODERATOR_SHORT_NAMES: Partial<Record<string, string>> = {
  problem_statement: "Problem Statements",
  voting: "Problem Voting",
};

const PHASES: PhaseSpec[] = CYCLE_WINDOWS.map((w) => ({
  num: w.position as PhaseNum,
  shortName: PODERATOR_SHORT_NAMES[w.key] ?? w.labels.short,
  openKey: w.openField as keyof CycleConfigPhaseColumns,
  closeKey: w.closeField as keyof CycleConfigPhaseColumns,
}));

function toResolved(spec: PhaseSpec, openAt: string | null, closeAt: string | null, isActive: boolean): ResolvedPhase {
  return {
    num: spec.num,
    displayName: `Phase ${spec.num}: ${spec.shortName}`,
    shortName: spec.shortName,
    openAt,
    closeAt,
    isActive,
  };
}

/**
 * Resolve the current phase. Returns:
 *   - the active phase if `now` is within an open window
 *   - otherwise the next upcoming phase (next opening) so the header can
 *     render "Opens in N days"
 *   - null if all phases have closed (cycle is over)
 */
export function resolveCurrentPhase(
  cfg: CycleConfigPhaseColumns,
  now: Date = new Date()
): ResolvedPhase | null {
  // First pass: active window
  for (const spec of PHASES) {
    const openAt = cfg[spec.openKey];
    const closeAt = cfg[spec.closeKey];
    if (!openAt || !closeAt) continue;
    if (
      now >= (parseWindow(openAt) as Date) &&
      now <= (parseWindow(closeAt) as Date)
    ) {
      return toResolved(spec, openAt, closeAt, true);
    }
  }

  // Second pass: nearest upcoming
  let upcoming: ResolvedPhase | null = null;
  let upcomingOpenMs = Infinity;
  for (const spec of PHASES) {
    const openAt = cfg[spec.openKey];
    if (!openAt) continue;
    const openMs = (parseWindow(openAt) as Date).getTime();
    if (openMs > now.getTime() && openMs < upcomingOpenMs) {
      upcoming = toResolved(spec, openAt, cfg[spec.closeKey], false);
      upcomingOpenMs = openMs;
    }
  }
  return upcoming;
}
