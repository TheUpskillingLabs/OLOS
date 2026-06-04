/**
 * Nudge key derivation + dismissal helpers (PRD §7.2).
 *
 * A `nudge_key` encodes a specific instance of a nudge so dismissals
 * persist across sessions but re-fire when the condition re-trips
 * (member recovers, then misses again — new key, new nudge).
 *
 * For at-risk nudges in v1 the key is:
 *   at_risk:{participant_id}:{first_miss_date}
 *
 * The `first_miss_date` is the scheduled_date of the earliest miss in
 * the current consecutive-miss run. When a member recovers (submits a
 * pulse), the run ends; on the next miss a new run starts with a new
 * `first_miss_date`, producing a new key the dismissal table hasn't
 * seen.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type AtRiskRun = {
  participant_id: number;
  /** ISO date of the earliest miss in the current consecutive run. */
  first_miss_date: string;
  /** Number of consecutive misses ending in the most recent scheduled pulse. */
  consecutiveMisses: number;
};

/** Compute the canonical nudge key for an at-risk run. */
export function atRiskNudgeKey(run: AtRiskRun): string {
  return `at_risk:${run.participant_id}:${run.first_miss_date}`;
}

/**
 * From a pulse stream sorted any-order, derive the current at-risk
 * run for a participant. Returns null if the most recent pulse was
 * submitted (no active run).
 */
export function deriveAtRiskRun(
  participantId: number,
  pulses: { scheduled_date: string; completed_at: string | null }[]
): AtRiskRun | null {
  if (pulses.length === 0) return null;
  const sortedDesc = [...pulses].sort((a, b) =>
    b.scheduled_date.localeCompare(a.scheduled_date)
  );
  if (sortedDesc[0].completed_at) return null;

  let consecutive = 0;
  let firstMissDate = sortedDesc[0].scheduled_date;
  for (const p of sortedDesc) {
    if (p.completed_at) break;
    consecutive += 1;
    firstMissDate = p.scheduled_date; // last assignment in the run is the earliest
  }
  return {
    participant_id: participantId,
    first_miss_date: firstMissDate,
    consecutiveMisses: consecutive,
  };
}

/**
 * Load dismissed nudge_keys for a poderator across the given pods.
 * Empty Set is returned when the caller has no participantId (admin
 * without a participant row).
 */
export async function loadDismissedKeys(
  supabase: SupabaseClient,
  moderatorParticipantId: number | null,
  podIds: number[]
): Promise<Set<string>> {
  if (!moderatorParticipantId || podIds.length === 0) return new Set();
  const { data } = await supabase
    .from("nudge_dismissals")
    .select("pod_id, nudge_key")
    .eq("moderator_participant_id", moderatorParticipantId)
    .in("pod_id", podIds);
  const set = new Set<string>();
  for (const row of data ?? []) {
    set.add(`${row.pod_id}:${row.nudge_key}`);
  }
  return set;
}

/** Lookup helper: was this nudge dismissed for this pod by this poderator? */
export function isDismissed(
  dismissed: Set<string>,
  podId: number,
  nudgeKey: string
): boolean {
  return dismissed.has(`${podId}:${nudgeKey}`);
}
