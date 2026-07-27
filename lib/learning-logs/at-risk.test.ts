import { describe, it, expect } from "vitest";
import { consecutiveMissedLogWeeks } from "./at-risk";

// A 13-week cycle: getCycleWeek slices [start, end] into weeks 0–12, so each
// week is 1/13 of the span. With a 13-day cycle, week N ≈ day N.
const start = new Date("2026-01-01T00:00:00Z");
const end = new Date("2026-01-14T00:00:00Z"); // 13 days → ~1 day per week

/** created_at at the midpoint of cycle-week `w`. */
function weekMid(w: number): Date {
  const totalMs = end.getTime() - start.getTime();
  return new Date(start.getTime() + ((w + 0.5) * totalMs) / 13);
}
/** "now" at the midpoint of week `w` (so weeks 0..w-1 are completed). */
const nowInWeek = weekMid;

describe("consecutiveMissedLogWeeks", () => {
  it("returns 0 before the cycle has any completed week", () => {
    // now during week 0 → no completed week yet
    expect(consecutiveMissedLogWeeks(nowInWeek(0), start, end, [])).toBe(0);
    // before the cycle starts
    expect(
      consecutiveMissedLogWeeks(new Date("2025-12-01T00:00:00Z"), start, end, [])
    ).toBe(0);
  });

  it("counts consecutive empty completed weeks back from the last completed one", () => {
    // now in week 4 → weeks 0,1,2,3 completed; no logs at all → 4 misses
    expect(consecutiveMissedLogWeeks(nowInWeek(4), start, end, [])).toBe(4);
  });

  it("does not count the in-progress current week as a miss", () => {
    // now in week 2 → completed weeks 0,1. A log in week 0 breaks the run at
    // the earliest completed week, so only week 1 is missed.
    expect(
      consecutiveMissedLogWeeks(nowInWeek(2), start, end, [weekMid(0)])
    ).toBe(1);
  });

  it("stops at the most recent completed week that has a log", () => {
    // now in week 5 → completed 0..4. Log in week 3 → weeks 4 missed (just 1),
    // run stops at week 3.
    expect(
      consecutiveMissedLogWeeks(nowInWeek(5), start, end, [weekMid(3)])
    ).toBe(1);
  });

  it("a log in the current (in-progress) week does not reset earlier misses", () => {
    // now in week 3 → completed 0,1,2 all empty; the only log is in week 3
    // (current, not completed) → 3 misses stand.
    expect(
      consecutiveMissedLogWeeks(nowInWeek(3), start, end, [weekMid(3)])
    ).toBe(3);
  });

  it("baseline logs before week 0 satisfy nothing", () => {
    const beforeStart = new Date("2025-12-20T00:00:00Z");
    expect(
      consecutiveMissedLogWeeks(nowInWeek(3), start, end, [beforeStart])
    ).toBe(3);
  });
});
