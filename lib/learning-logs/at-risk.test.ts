import { describe, it, expect } from "vitest";
import {
  consecutiveMissedLogWeeks,
  memberCadenceFloor,
  type MissedLogFloor,
} from "./at-risk";

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

/**
 * The floor for a member who has been enrolled, podded and under an armed
 * window since before kickoff, i.e. no floor at all. Every pre-existing
 * assertion below uses this, so it pins the unchanged behaviour for a member
 * present from week 0.
 */
const noFloor: MissedLogFloor = {
  memberActiveSince: new Date("2025-12-01T00:00:00Z"),
  windowArmedSince: new Date("2025-12-01T00:00:00Z"),
};

/** A floor where the member arrived (and the window was armed) in week `w`. */
function floorAtWeek(w: number): MissedLogFloor {
  return { memberActiveSince: weekMid(w), windowArmedSince: weekMid(w) };
}

describe("consecutiveMissedLogWeeks", () => {
  it("returns 0 before the cycle has any completed week", () => {
    // now during week 0 → no completed week yet
    expect(consecutiveMissedLogWeeks(nowInWeek(0), start, end, [], noFloor)).toBe(
      0
    );
    // before the cycle starts
    expect(
      consecutiveMissedLogWeeks(
        new Date("2025-12-01T00:00:00Z"),
        start,
        end,
        [],
        noFloor
      )
    ).toBe(0);
  });

  it("counts consecutive empty completed weeks back from the last completed one", () => {
    // now in week 4 → weeks 0,1,2,3 completed; no logs at all → 4 misses
    expect(consecutiveMissedLogWeeks(nowInWeek(4), start, end, [], noFloor)).toBe(
      4
    );
  });

  it("does not count the in-progress current week as a miss", () => {
    // now in week 2 → completed weeks 0,1. A log in week 0 breaks the run at
    // the earliest completed week, so only week 1 is missed.
    expect(
      consecutiveMissedLogWeeks(nowInWeek(2), start, end, [weekMid(0)], noFloor)
    ).toBe(1);
  });

  it("stops at the most recent completed week that has a log", () => {
    // now in week 5 → completed 0..4. Log in week 3 → weeks 4 missed (just 1),
    // run stops at week 3.
    expect(
      consecutiveMissedLogWeeks(nowInWeek(5), start, end, [weekMid(3)], noFloor)
    ).toBe(1);
  });

  it("a log in the current (in-progress) week does not reset earlier misses", () => {
    // now in week 3 → completed 0,1,2 all empty; the only log is in week 3
    // (current, not completed) → 3 misses stand.
    expect(
      consecutiveMissedLogWeeks(nowInWeek(3), start, end, [weekMid(3)], noFloor)
    ).toBe(3);
  });

  it("baseline logs before week 0 satisfy nothing", () => {
    const beforeStart = new Date("2025-12-20T00:00:00Z");
    expect(
      consecutiveMissedLogWeeks(nowInWeek(3), start, end, [beforeStart], noFloor)
    ).toBe(3);
  });

  describe("floors", () => {
    it("does not penalise a member for weeks before they joined", () => {
      // now in week 9 → completed 0..8. Unfloored this is 9 misses and an
      // instant revocation; the member only arrived in week 6, so only weeks
      // 6, 7 and 8 were ever theirs to miss.
      expect(
        consecutiveMissedLogWeeks(nowInWeek(9), start, end, [], floorAtWeek(6))
      ).toBe(3);
    });

    it("counts nothing when the member joined during the in-progress week", () => {
      // now in week 6, member arrived in week 6 → no completed week of theirs.
      expect(
        consecutiveMissedLogWeeks(nowInWeek(6), start, end, [], floorAtWeek(6))
      ).toBe(0);
    });

    it("does not count weeks before the window was armed", () => {
      // A cohort enrolled from kickoff, but the weekly-log ritual only started
      // in week 8 (first log anywhere in the cycle). Weeks 0–7 predate the
      // ritual and must not count; now in week 10 leaves weeks 8 and 9.
      const floor: MissedLogFloor = {
        memberActiveSince: new Date("2025-12-01T00:00:00Z"),
        windowArmedSince: weekMid(8),
      };
      expect(consecutiveMissedLogWeeks(nowInWeek(10), start, end, [], floor)).toBe(
        2
      );
    });

    it("takes the later of the two floors", () => {
      // Window armed week 2, member joined week 7 → week 7 wins.
      const floor: MissedLogFloor = {
        memberActiveSince: weekMid(7),
        windowArmedSince: weekMid(2),
      };
      expect(consecutiveMissedLogWeeks(nowInWeek(10), start, end, [], floor)).toBe(
        3
      );
    });

    it("counts a genuine run of misses that sits after both floors", () => {
      // Window armed week 2, member joined week 3, they logged in weeks 3 and
      // 4, then stopped. now in week 8 → weeks 5,6,7 are a real run of 3.
      const floor: MissedLogFloor = {
        memberActiveSince: weekMid(3),
        windowArmedSince: weekMid(2),
      };
      expect(
        consecutiveMissedLogWeeks(
          nowInWeek(8),
          start,
          end,
          [weekMid(3), weekMid(4)],
          floor
        )
      ).toBe(3);
    });

    it("counts nothing for a cycle with no evidence the window was ever armed", () => {
      // windowArmedSince null = no learning_logs row anywhere in this cycle,
      // i.e. a cycle that ran before the weekly-log window existed. Pointing
      // the admin sweep at it must not revoke the entire cohort.
      const floor: MissedLogFloor = {
        memberActiveSince: new Date("2025-12-01T00:00:00Z"),
        windowArmedSince: null,
      };
      expect(consecutiveMissedLogWeeks(nowInWeek(12), start, end, [], floor)).toBe(
        0
      );
    });

    it("counts nothing when the member floor is undateable", () => {
      const floor: MissedLogFloor = {
        memberActiveSince: null,
        windowArmedSince: weekMid(0),
      };
      expect(consecutiveMissedLogWeeks(nowInWeek(12), start, end, [], floor)).toBe(
        0
      );
    });
  });
});

describe("memberCadenceFloor", () => {
  it("takes the later of the enrolment and the pod join", () => {
    const enrolled = new Date("2026-01-02T00:00:00Z");
    const joined = new Date("2026-01-06T00:00:00Z");
    expect(memberCadenceFloor(enrolled, joined)).toEqual(joined);
    expect(memberCadenceFloor(joined, enrolled)).toEqual(joined);
  });

  it("is undateable when either signal is missing", () => {
    const d = new Date("2026-01-02T00:00:00Z");
    // A status='active' enrolment with no active pod membership is an
    // inconsistent row, not a long-standing member; guessing there is exactly
    // how a member who did nothing wrong gets revoked.
    expect(memberCadenceFloor(d, null)).toBeNull();
    expect(memberCadenceFloor(null, d)).toBeNull();
    expect(memberCadenceFloor(null, null)).toBeNull();
  });
});
