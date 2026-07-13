/**
 * Phase resolver for the poderator dashboard (PRD §7.1).
 *
 * Maps the current timestamp to one of the cycle's operational phases
 * using cycle_config window pairs. Six phases total — matches the
 * canonical OPERATIONAL_WINDOWS in
 * app/(dashboard)/cycles/cycle-phase-indicator.tsx:58-65.
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

const PHASES: PhaseSpec[] = [
  { num: 1, shortName: "Problem Statements", openKey: "problem_statement_open", closeKey: "problem_statement_close" },
  { num: 2, shortName: "Problem Voting", openKey: "voting_open", closeKey: "voting_close" },
  { num: 3, shortName: "Pod Registration", openKey: "pod_registration_open", closeKey: "pod_registration_close" },
  { num: 4, shortName: "Solution Proposals", openKey: "solution_proposal_open", closeKey: "solution_proposal_close" },
  { num: 5, shortName: "Solution Voting", openKey: "solution_voting_open", closeKey: "solution_voting_close" },
  { num: 6, shortName: "Project Registration", openKey: "project_registration_open", closeKey: "project_registration_close" },
];

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
