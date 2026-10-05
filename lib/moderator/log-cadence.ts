import { getCycleWeek, getCycleWeekStart } from "@/lib/cycle/week";
import { floorWeekOf, type MissedLogFloor } from "@/lib/learning-logs/at-risk";

// A member's weekly cadence, expressed as pulse-shaped rows so the Poderator
// status/streak/miss/bucket engine (lib/moderator/pod-detail.ts) works
// unchanged regardless of source. Legacy pods feed real pulse_checks rows;
// log-based (current) cycles feed rows SYNTHESIZED from the weekly Learning
// Log windows — one row per completed cycle-week the member was answerable
// for, completed_at set iff a log was filed that week.
export type CadenceRow = {
  participant_id: number;
  scheduled_date: string;
  completed_at: string | null;
};

/**
 * Synthesize a member's weekly cadence from their Learning Logs: for each
 * completed cycle-week (getCycleWeek buckets [start,end] into weeks 0–12) from
 * the member's floor week onward, a row keyed by that week's start, marked
 * completed iff any cycle-attributed log lands in it. The in-progress current
 * week is not emitted (it can't be "missed" yet).
 *
 * The floor (#463) is the SAME one the member-facing compliance and the
 * revocation cron use (MissedLogFloor, lib/learning-logs/at-risk.ts): the later
 * of the member's cadence start (memberCadenceFloor: enrolment ∧ pod join) and
 * the cycle's first cohort log. Weeks before it are not the member's to miss,
 * so they are not emitted: a member who joins in week 6 is answerable from
 * week 6, not flagged at-risk on arrival. Either half undateable ⇒ no rows ⇒
 * nobody flagged (a false negative delays a flag by a week; a false positive
 * puts someone at the top of an outreach list who did nothing wrong). The
 * floor week itself is countable, matching consecutiveMissedLogWeeks.
 */
export function synthesizeLogCadence(
  participantId: number,
  now: Date,
  cycleStart: Date,
  cycleEnd: Date,
  logCreatedAts: Date[],
  floor: MissedLogFloor
): CadenceRow[] {
  const currentWeek = getCycleWeek(now, cycleStart, cycleEnd);
  const lastCompleted = Math.min(currentWeek, 13) - 1;
  if (lastCompleted < 0) return [];
  if (!floor.memberActiveSince || !floor.windowArmedSince) return [];

  const floorWeek = Math.max(
    floorWeekOf(floor.memberActiveSince, cycleStart, cycleEnd),
    floorWeekOf(floor.windowArmedSince, cycleStart, cycleEnd)
  );
  if (floorWeek > lastCompleted) return [];

  const latestLogByWeek = new Map<number, string>();
  for (const d of logCreatedAts) {
    const w = getCycleWeek(d, cycleStart, cycleEnd);
    const iso = d.toISOString();
    const prev = latestLogByWeek.get(w);
    if (!prev || iso > prev) latestLogByWeek.set(w, iso);
  }

  const rows: CadenceRow[] = [];
  for (let w = floorWeek; w <= lastCompleted; w++) {
    const weekKey = getCycleWeekStart(w, cycleStart, cycleEnd)
      .toISOString()
      .slice(0, 10);
    rows.push({
      participant_id: participantId,
      scheduled_date: weekKey,
      completed_at: latestLogByWeek.get(w) ?? null,
    });
  }
  return rows;
}
