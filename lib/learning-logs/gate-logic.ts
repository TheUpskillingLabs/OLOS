/* The weekly Learning Log gate's pure resolution logic (owner decision: "the
   weekly cadence has teeth" — firm, instant to clear, never shaming). Kept
   free of any Supabase import so the matrix below is unit-testable without
   mocks (lib/learning-logs/gate-logic.test.ts); lib/learning-logs/gate.ts is
   the thin Supabase-reading wrapper that feeds this.

   Fixed per-cycle window, not a rolling personal timer (the pulse gate it
   replaces drifted per member): an admin stamps a cycle's
   cycle_config.log_due_at; an ACTIVE enrollee of that cycle with no
   qualifying learning_logs row at/after the stamp is locked to the
   dashboard until they save one. Saving clears it instantly.
   log_gate_paused is the admin grace/holiday toggle.

   Org cycles (migration 00060) made "the active cycle" plural — the
   participant ('open') cycle and the org cycle can both be status='active'
   at once, and a dual-enrolled staff member can hold an active enrollment
   in both simultaneously. The gate is now resolved PER CYCLE: a member is
   locked if ANY armed cycle they're actively enrolled in has no qualifying
   log since ITS stamp — clearing one cycle's window does not clear
   another's, so dual-enrolled staff file one log per cycle. This is also
   why a standalone log (cycle_id NULL) no longer clears anything: with more
   than one concurrent window, "any log, any cycle" stopped being a
   well-defined signal, so a log must be attributed to the specific cycle
   whose window it's satisfying (a deliberate behavior change from the
   single-cycle gate, where any log cleared it). Members enrolled in no
   active cycle, or only in cycles whose gate isn't armed, are never gated —
   the ritual is cycle practice, not a site-wide toll. */

/** One of the member's active enrollments in an active cycle, plus whether
    a log already satisfies it. Built by gate.ts from three Supabase reads
    (cycles, cycle_enrollments, cycle_config) + one learning_logs count per
    armed cycle. */
export interface GateCycleInput {
  cycleId: number;
  cycleName: string;
  mode: string;
  logDueAt: string | null;
  gatePaused: boolean;
  hasLogSinceStamp: boolean;
}

/** An armed-and-unmet cycle — one entry in the lock reason. */
export interface PendingGate {
  cycleId: number;
  cycleName: string;
  mode: string;
  dueAt: string;
}

export interface GateResolution {
  /** Locked right now — every dashboard route but Home should bounce. */
  active: boolean;
  /** At least one of the member's enrolled cycles has an armed window
      (regardless of whether it's currently met). */
  armed: boolean;
  /** Every armed-and-unmet cycle, in input order. */
  pending: PendingGate[];
}

/** A cycle is "armed" once an admin has stamped a due date and hasn't
    paused it — a cycle with no log_due_at yet, or one on grace, never
    contributes to the lock. */
function isArmed(cycle: GateCycleInput): boolean {
  return cycle.logDueAt !== null && !cycle.gatePaused;
}

export function resolveGate(cycles: GateCycleInput[]): GateResolution {
  const armedCycles = cycles.filter(isArmed);
  const pending: PendingGate[] = armedCycles
    .filter((cycle) => !cycle.hasLogSinceStamp)
    .map((cycle) => ({
      cycleId: cycle.cycleId,
      cycleName: cycle.cycleName,
      mode: cycle.mode,
      dueAt: cycle.logDueAt as string,
    }));

  return {
    active: pending.length > 0,
    armed: armedCycles.length > 0,
    pending,
  };
}
