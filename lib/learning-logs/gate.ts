import { createServiceClient } from "@/lib/supabase/server";
import {
  resolveGate,
  type GateCycleInput,
  type PendingGate,
} from "@/lib/learning-logs/gate-logic";
import {
  eligibleLogCycles,
  type EligibleLogCycle,
} from "@/lib/learning-logs/eligible";

/* The weekly Learning Log gate (owner decision: "the weekly cadence has
   teeth" — firm, instant to clear, never shaming).

   Fixed per-cycle window, not a rolling personal timer (the pulse gate it
   replaces drifted per member): the Friday cron stamps
   cycle_config.log_due_at; an ACTIVE enrollee of that cycle with no
   learning_logs row attributed to it at/after the stamp is locked to the
   dashboard until they save one. Saving clears it instantly. log_gate_paused
   is the admin grace/holiday toggle. Members outside every active cycle are
   never gated — the ritual is cycle practice, not a site-wide toll.

   Org cycles (migration 00060) mean more than one cycle can be
   `status='active'` at once (the participant 'open' cycle and the org
   cycle), and a dual-enrolled staff member can hold an active enrollment in
   both. The gate is resolved per cycle — see lib/learning-logs/gate-logic.ts
   for the pure matrix and the standalone-log behavior change. */

export interface LogGateState {
  /** Locked right now — every dashboard route but Home should bounce. */
  active: boolean;
  /** At least one of the member's enrolled cycles has an armed window
      (regardless of lock). */
  armed: boolean;
  /** The first pending (armed + unmet) cycle's due date, or null. */
  dueAt: string | null;
  /** The first pending cycle's id, or null. */
  cycleId: number | null;
  /** Every armed-and-unmet cycle — the full lock reason, for callers that
      need to name more than one (e.g. dual-enrolled staff). */
  pending: PendingGate[];
}

const INACTIVE: LogGateState = {
  active: false,
  armed: false,
  dueAt: null,
  cycleId: null,
  pending: [],
};

export async function learningLogGate(
  participantId: number,
  // Callers that already fetched eligibleLogCycles this request (e.g. the
  // learning-logs POST route, which reads the gate before AND after the
  // write) can pass it in to skip a redundant cycles+enrollments round
  // trip — the enrolled-cycle set doesn't change from filing a log, only
  // the per-cycle log counts do, so it's safe to reuse across gateBefore /
  // gateAfter. Omit it and this fetches its own, as before.
  precomputedEligibleCycles?: EligibleLogCycle[]
): Promise<LogGateState> {
  const supabase = createServiceClient();

  // Every currently active cycle, across modes, the member is actively
  // enrolled in — 00060 means more than one can legitimately come back (the
  // participant cycle and the org cycle). The single definition lives in
  // lib/learning-logs/eligible.ts so gate.ts, the learning-logs route, and
  // the dashboard never drift on what "eligible" means.
  const enrolledCycles =
    precomputedEligibleCycles ?? (await eligibleLogCycles(participantId));
  if (enrolledCycles.length === 0) return INACTIVE;

  const { data: configs } = await supabase
    .from("cycle_config")
    .select("cycle_id, log_due_at, log_gate_paused")
    .in(
      "cycle_id",
      enrolledCycles.map((c) => c.id)
    );

  // Only cycles with a stamp that isn't paused ever contribute to the lock —
  // no point counting logs for a cycle that can't gate anything.
  const armedEntries = enrolledCycles
    .map((cycle) => ({
      cycle,
      config: (configs ?? []).find((cfg) => cfg.cycle_id === cycle.id),
    }))
    .filter(
      (
        entry
      ): entry is {
        cycle: (typeof enrolledCycles)[number];
        config: { cycle_id: number; log_due_at: string; log_gate_paused: boolean };
      } => !!entry.config?.log_due_at && !entry.config.log_gate_paused
    );

  // One count per armed cycle: the ">= stamp" bound differs per cycle, and
  // the log must be attributed to that specific cycle_id (standalone logs no
  // longer clear anything — gate-logic.ts explains why).
  const inputs: GateCycleInput[] = await Promise.all(
    armedEntries.map(async ({ cycle, config }) => {
      const { count } = await supabase
        .from("learning_logs")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participantId)
        .eq("cycle_id", cycle.id)
        .gte("created_at", config.log_due_at);
      return {
        cycleId: cycle.id,
        cycleName: cycle.name,
        mode: cycle.mode,
        logDueAt: config.log_due_at,
        gatePaused: config.log_gate_paused,
        hasLogSinceStamp: (count ?? 0) > 0,
      };
    })
  );

  const resolution = resolveGate(inputs);
  const first = resolution.pending[0] ?? null;
  return {
    active: resolution.active,
    armed: resolution.armed,
    dueAt: first?.dueAt ?? null,
    cycleId: first?.cycleId ?? null,
    pending: resolution.pending,
  };
}
