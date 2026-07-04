import { createServiceClient } from "@/lib/supabase/server";

/* The weekly Learning Log gate (owner decision: "the weekly cadence has
   teeth" — firm, instant to clear, never shaming).

   Fixed per-cycle window, not a rolling personal timer (the pulse gate it
   replaces drifted per member): the Friday cron stamps
   cycle_config.log_due_at; an ACTIVE enrollee of that cycle with no
   learning_logs row at/after the stamp is locked to the dashboard until
   they save one. Saving clears it instantly. log_gate_paused is the admin
   grace/holiday toggle. Members outside an active cycle are never gated —
   the ritual is cycle practice, not a site-wide toll. */

export interface LogGateState {
  /** Locked right now — every dashboard route but Home should bounce. */
  active: boolean;
  /** A window has been armed for the member's cycle (regardless of lock). */
  armed: boolean;
  dueAt: string | null;
  cycleId: number | null;
}

const INACTIVE: LogGateState = {
  active: false,
  armed: false,
  dueAt: null,
  cycleId: null,
};

export async function learningLogGate(
  participantId: number
): Promise<LogGateState> {
  const supabase = createServiceClient();

  // The member's ACTIVE enrollment in the ACTIVE cycle (house model: one
  // cycle is active at a time).
  const { data: cycle } = await supabase
    .from("cycles")
    .select("id")
    .eq("status", "active")
    .maybeSingle();
  if (!cycle) return INACTIVE;

  const { data: enrollment } = await supabase
    .from("cycle_enrollments")
    .select("id")
    .eq("participant_id", participantId)
    .eq("cycle_id", cycle.id)
    .eq("status", "active")
    .maybeSingle();
  if (!enrollment) return INACTIVE;

  const { data: config } = await supabase
    .from("cycle_config")
    .select("log_due_at, log_gate_paused")
    .eq("cycle_id", cycle.id)
    .maybeSingle();
  if (!config?.log_due_at || config.log_gate_paused) {
    return { ...INACTIVE, cycleId: cycle.id };
  }

  // Any log saved at/after the stamp clears the window — kind and cycle
  // don't matter (a standalone reflection still is the practice; the
  // prototype's gate reads the member's log stream the same way).
  const { count } = await supabase
    .from("learning_logs")
    .select("id", { count: "exact", head: true })
    .eq("participant_id", participantId)
    .gte("created_at", config.log_due_at);

  return {
    active: (count ?? 0) === 0,
    armed: true,
    dueAt: config.log_due_at,
    cycleId: cycle.id,
  };
}
