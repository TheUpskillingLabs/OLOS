import { getCycleWeek } from "@/lib/cycle/week";

/**
 * The weekly Learning Log's engagement signal, the counterpart to
 * deriveAtRiskRun (lib/moderator/nudges.ts) for pulse checks. The pulse
 * detector reads per-week pulse_checks rows; the Learning Log has no such
 * per-window schedule table (the gate is driven by a single rolling
 * cycle_config.log_due_at stamp), so we reconstruct the weekly windows from
 * the cycle calendar the way the rest of the app does — getCycleWeek buckets
 * [start, end] into 13 equal weeks (0–12).
 *
 * "Missed a week" = a completed cycle-week with no learning_logs row
 * attributed to the cycle in it. Any kind counts (weekly, milestone review,
 * org) — filing *something* that week is engagement. The in-progress current
 * week is never counted as a miss (the member still has time to log it), and
 * baseline/standalone logs filed before week 0 satisfy nothing.
 *
 * Returns the number of consecutive missed weeks counting back from the most
 * recently COMPLETED week; 0 before the cycle has any completed week.
 */
export function consecutiveMissedLogWeeks(
  now: Date,
  cycleStart: Date,
  cycleEnd: Date,
  logCreatedAts: Date[]
): number {
  const currentWeek = getCycleWeek(now, cycleStart, cycleEnd);
  // Completed weeks are 0 .. currentWeek-1. getCycleWeek returns -1 before the
  // cycle starts and 13 after it ends; clamp so "last completed" never exceeds
  // week 12.
  const lastCompleted = Math.min(currentWeek, 13) - 1;
  if (lastCompleted < 0) return 0;

  const loggedWeeks = new Set(
    logCreatedAts.map((d) => getCycleWeek(d, cycleStart, cycleEnd))
  );

  let consecutive = 0;
  for (let w = lastCompleted; w >= 0; w--) {
    if (loggedWeeks.has(w)) break;
    consecutive++;
  }
  return consecutive;
}
