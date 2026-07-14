import { describe, it, expect } from "vitest";
import { getCycleWeek, getCycleWeekStart } from "./week";
import { milestoneKindForWeek, MILESTONES } from "./milestones";

const start = new Date("2026-01-05T00:00:00Z");
// 13 weekly markers over the span → pick an end exactly 13 weeks out so week
// boundaries land cleanly.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const end = new Date(start.getTime() + 13 * WEEK_MS);

describe("getCycleWeek", () => {
  it("is -1 before the cycle starts", () => {
    expect(getCycleWeek(new Date(start.getTime() - 1), start, end)).toBe(-1);
  });

  it("is 0 at the start (Kickoff week)", () => {
    expect(getCycleWeek(start, start, end)).toBe(0);
  });

  it("advances one marker per elapsed 1/13 of the span", () => {
    expect(getCycleWeek(new Date(start.getTime() + 6 * WEEK_MS), start, end)).toBe(6);
    expect(getCycleWeek(new Date(start.getTime() + 11.5 * WEEK_MS), start, end)).toBe(11);
  });

  it("clamps to 12 at/near the end (Showcase week)", () => {
    expect(getCycleWeek(new Date(end.getTime() - 1), start, end)).toBe(12);
  });

  it("is 13 past the end", () => {
    expect(getCycleWeek(new Date(end.getTime() + 1), start, end)).toBe(13);
  });

  it("handles a zero-length span without dividing by zero", () => {
    expect(getCycleWeek(start, start, start)).toBe(0);
  });
});

describe("getCycleWeekStart", () => {
  it("returns the cycle start for week 0", () => {
    expect(getCycleWeekStart(0, start, end).getTime()).toBe(start.getTime());
  });

  it("round-trips with getCycleWeek for weeks 0–12", () => {
    for (let w = 0; w <= 12; w++) {
      const weekStart = getCycleWeekStart(w, start, end);
      // An instant just after a week's start lands inside that week.
      expect(getCycleWeek(new Date(weekStart.getTime() + 1), start, end)).toBe(w);
    }
  });

  it("spaces the 13 markers evenly across the span", () => {
    const span = end.getTime() - start.getTime();
    expect(getCycleWeekStart(6, start, end).getTime()).toBe(
      start.getTime() + (6 * span) / 13
    );
  });
});

describe("milestoneKindForWeek", () => {
  const weeks = { milestone_mid_week: 6, milestone_final_week: 12 };

  it("returns the mid milestone on its configured week", () => {
    expect(milestoneKindForWeek(6, weeks)).toBe("milestone_7");
  });

  it("returns the final milestone on its configured week", () => {
    expect(milestoneKindForWeek(12, weeks)).toBe("milestone_13");
  });

  it("returns null on a non-milestone week", () => {
    expect(milestoneKindForWeek(5, weeks)).toBeNull();
    expect(milestoneKindForWeek(0, weeks)).toBeNull();
  });

  it("respects reconfigured weeks", () => {
    expect(
      milestoneKindForWeek(4, { milestone_mid_week: 4, milestone_final_week: 10 })
    ).toBe("milestone_7");
    expect(
      milestoneKindForWeek(10, { milestone_mid_week: 4, milestone_final_week: 10 })
    ).toBe("milestone_13");
  });

  it("MILESTONES covers both kinds", () => {
    expect(MILESTONES.map((m) => m.kind)).toEqual(["milestone_7", "milestone_13"]);
  });
});
