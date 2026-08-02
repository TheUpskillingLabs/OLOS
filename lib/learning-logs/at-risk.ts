import { getCycleWeek } from "@/lib/cycle/week";

/**
 * The floor on consecutiveMissedLogWeeks: the two dates below bound how far
 * back a run of missed weeks may reach. Without them the count runs to week 0
 * of the cycle, so a member who joined in week 6 reads as six consecutive
 * misses the moment they arrive, and every member of a cycle that ran before
 * the weekly-log window existed reads as twelve. Pointed at a live cohort
 * that revokes people who did nothing wrong.
 *
 * Both are supplied by the caller so this module stays pure and unit-testable
 * (see the two loaders' contracts on memberCadenceFloor below and on
 * `windowArmedSince`). `null` means "no dateable signal", which is deliberately
 * read as "no week can be attributed to this member" and yields zero misses.
 * A false negative delays a warning by a week; a false positive revokes
 * someone who did nothing wrong.
 */
export interface MissedLogFloor {
  /**
   * When this member became subject to the cycle's weekly cadence. Built by
   * memberCadenceFloor from the enrolment row and the pod join.
   */
  memberActiveSince: Date | null;
  /**
   * The earliest instant the cycle's weekly-log window is known to have been
   * running. There is NO stored first-armed timestamp: cycle_config.log_due_at
   * is a single rolling stamp that /api/cron/learning-log-window overwrites
   * every Friday and NULLs out on pause, so it records the most recent arming
   * only. The best available evidence is the earliest cycle-attributed
   * learning_logs row across the whole cohort: the ritual demonstrably was not
   * running in this cycle before anyone in it filed anything. A cycle with no
   * logs at all has no evidence of an armed window, so callers pass null and
   * nobody in it is ever counted as missing a week.
   */
  windowArmedSince: Date | null;
}

/**
 * The member half of the floor: the later of
 *
 *   1. `enrolledAt`   - cycle_enrollments.enrolled_at, the first moment a log
 *                       could be attributed to this cycle at all, and
 *   2. `podJoinedAt`  - the earliest still-active pod_memberships.joined_at in
 *                       this cycle, the first moment the weekly cadence had
 *                       teeth for them (lib/learning-logs/gate.ts locks only
 *                       'active', in-a-pod members; the ritual is a pod
 *                       practice, and the revocation paths iterate only
 *                       status='active' enrolments).
 *
 * There is no cycle_enrollments.activation_date column, so the pod join is the
 * closest thing to one that actually exists.
 *
 * Either being unknown returns null. For a status='active' enrolment a missing
 * pod join is an inconsistent row, not evidence of a long-standing member, and
 * guessing in that state is exactly how the false positives happen.
 */
export function memberCadenceFloor(
  enrolledAt: Date | null,
  podJoinedAt: Date | null
): Date | null {
  if (!enrolledAt || !podJoinedAt) return null;
  return enrolledAt > podJoinedAt ? enrolledAt : podJoinedAt;
}

/**
 * The cycle-week a floor date lands in, clamped at week 0. getCycleWeek
 * returns -1 for an instant before the cycle starts; a member enrolled and
 * podded from kickoff therefore floors at week 0, i.e. no floor at all, which
 * keeps the pre-existing behaviour for a member present from the start.
 */
function floorWeekOf(d: Date, cycleStart: Date, cycleEnd: Date): number {
  return Math.max(0, getCycleWeek(d, cycleStart, cycleEnd));
}

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
 * recently COMPLETED week down to `floor` (see MissedLogFloor); 0 before the
 * cycle has any completed week, and 0 whenever the floor is undateable or
 * already past the last completed week.
 *
 * The floor week itself IS countable. A member joins partway through a week
 * but the composer is open for the rest of it, and excluding the joining week
 * outright would also drop week 0 for a member present from kickoff, changing
 * the established meaning of the count for the ordinary case.
 */
export function consecutiveMissedLogWeeks(
  now: Date,
  cycleStart: Date,
  cycleEnd: Date,
  logCreatedAts: Date[],
  floor: MissedLogFloor
): number {
  const currentWeek = getCycleWeek(now, cycleStart, cycleEnd);
  // Completed weeks are 0 .. currentWeek-1. getCycleWeek returns -1 before the
  // cycle starts and 13 after it ends; clamp so "last completed" never exceeds
  // week 12.
  const lastCompleted = Math.min(currentWeek, 13) - 1;
  if (lastCompleted < 0) return 0;

  // No dateable floor means we cannot say which weeks were the member's to
  // miss, so none of them are.
  if (!floor.memberActiveSince || !floor.windowArmedSince) return 0;

  const floorWeek = Math.max(
    floorWeekOf(floor.memberActiveSince, cycleStart, cycleEnd),
    floorWeekOf(floor.windowArmedSince, cycleStart, cycleEnd)
  );
  // Joined (or the window armed) during the in-progress week, or after the
  // cycle ended: there is no completed week they could have missed.
  if (floorWeek > lastCompleted) return 0;

  const loggedWeeks = new Set(
    logCreatedAts.map((d) => getCycleWeek(d, cycleStart, cycleEnd))
  );

  let consecutive = 0;
  for (let w = lastCompleted; w >= floorWeek; w--) {
    if (loggedWeeks.has(w)) break;
    consecutive++;
  }
  return consecutive;
}
