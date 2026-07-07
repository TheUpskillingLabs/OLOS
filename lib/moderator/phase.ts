/**
 * Phase resolver for the poderator dashboard.
 *
 * The implementation moved to lib/cycle/phases.ts — the canonical, shared home
 * for the six operational cycle windows (now also used by the member dashboard).
 * This module re-exports it so the poderator surface (pods-list.ts, pod-detail.ts)
 * keeps its existing import path with no behaviour change.
 */

export {
  resolveCurrentPhase,
  type PhaseNum,
  type ResolvedPhase,
  type CycleConfigPhaseColumns,
} from "@/lib/cycle/phases";
