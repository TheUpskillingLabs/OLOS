import { describe, expect, it } from "vitest";
import { getCycleWeekStart } from "@/lib/cycle/week";
import { synthesizeLogCadence } from "./log-cadence";

// Cycle 3's shape: a 91-day span, so each of the 13 buckets is exactly 7 days.
const start = new Date("2026-07-14T20:30:00Z");
const end = new Date("2026-10-13T20:30:00Z");
const weekStart = (w: number) => getCycleWeekStart(w, start, end);
const midWeek = (w: number) => new Date(weekStart(w).getTime() + 3 * 24 * 3600 * 1000);
// "Now" is mid-week 9, so weeks 0–8 are complete.
const now = midWeek(9);
const armed = midWeek(0); // the cohort's first log, week 0

describe("synthesizeLogCadence", () => {
  it("emits every completed week for a member present from kickoff (unchanged behaviour)", () => {
    const rows = synthesizeLogCadence(1, now, start, end, [midWeek(0), midWeek(8)], {
      memberActiveSince: new Date(start.getTime() - 24 * 3600 * 1000),
      windowArmedSince: armed,
    });
    expect(rows).toHaveLength(9);
    expect(rows[0].completed_at).not.toBeNull();
    expect(rows[1].completed_at).toBeNull();
    expect(rows[8].completed_at).not.toBeNull();
  });

  it("starts a week-6 joiner at week 6, so they are not flagged for weeks before they arrived (#463)", () => {
    const logs = [midWeek(6), midWeek(7), midWeek(8)];
    const rows = synthesizeLogCadence(2, now, start, end, logs, {
      memberActiveSince: midWeek(6),
      windowArmedSince: armed,
    });
    expect(rows).toHaveLength(3);
    expect(rows[0].scheduled_date).toBe(weekStart(6).toISOString().slice(0, 10));
    expect(rows.every((r) => r.completed_at !== null)).toBe(true);
  });

  it("counts the joining week itself, matching the member-facing floor", () => {
    const rows = synthesizeLogCadence(3, now, start, end, [], {
      memberActiveSince: midWeek(7),
      windowArmedSince: armed,
    });
    expect(rows.map((r) => r.scheduled_date)).toEqual([
      weekStart(7).toISOString().slice(0, 10),
      weekStart(8).toISOString().slice(0, 10),
    ]);
  });

  it("floors at the cohort's first log when the weekly ritual started later than the join", () => {
    const rows = synthesizeLogCadence(4, now, start, end, [], {
      memberActiveSince: midWeek(0),
      windowArmedSince: midWeek(5),
    });
    expect(rows).toHaveLength(4); // weeks 5–8
  });

  it("emits nothing when either half of the floor is undateable", () => {
    expect(
      synthesizeLogCadence(5, now, start, end, [], { memberActiveSince: null, windowArmedSince: armed })
    ).toEqual([]);
    expect(
      synthesizeLogCadence(5, now, start, end, [], { memberActiveSince: midWeek(0), windowArmedSince: null })
    ).toEqual([]);
  });

  it("emits nothing for a member who joined during the in-progress week", () => {
    expect(
      synthesizeLogCadence(6, now, start, end, [], { memberActiveSince: midWeek(9), windowArmedSince: armed })
    ).toEqual([]);
  });

  it("emits nothing before the cycle has a completed week", () => {
    expect(
      synthesizeLogCadence(7, midWeek(0), start, end, [], { memberActiveSince: start, windowArmedSince: armed })
    ).toEqual([]);
  });
});
