import { describe, expect, it } from "vitest";
import { atRiskNudgeKey, deriveAtRiskRun, isDismissed } from "./nudges";

describe("deriveAtRiskRun", () => {
  it("returns null with no pulses", () => {
    expect(deriveAtRiskRun(1, [])).toBeNull();
  });

  it("returns null when the most recent pulse was submitted", () => {
    expect(
      deriveAtRiskRun(1, [
        { scheduled_date: "2026-06-19", completed_at: null },
        { scheduled_date: "2026-06-26", completed_at: "2026-06-26T10:00:00Z" },
      ])
    ).toBeNull();
  });

  it("counts the consecutive run and anchors first_miss_date at the earliest miss", () => {
    const run = deriveAtRiskRun(7, [
      { scheduled_date: "2026-06-12", completed_at: "2026-06-12T09:00:00Z" },
      { scheduled_date: "2026-06-19", completed_at: null },
      { scheduled_date: "2026-06-26", completed_at: null },
    ]);
    expect(run).toEqual({
      participant_id: 7,
      first_miss_date: "2026-06-19",
      consecutiveMisses: 2,
    });
  });

  it("stops the run at the first completed pulse (recovery resets the key)", () => {
    const run = deriveAtRiskRun(7, [
      { scheduled_date: "2026-06-05", completed_at: null },
      { scheduled_date: "2026-06-12", completed_at: "2026-06-12T09:00:00Z" },
      { scheduled_date: "2026-06-19", completed_at: null },
      { scheduled_date: "2026-06-26", completed_at: null },
    ]);
    // The 06-05 miss is behind a recovery — not part of the current run.
    expect(run?.first_miss_date).toBe("2026-06-19");
    expect(run?.consecutiveMisses).toBe(2);
  });

  it("tolerates unsorted input", () => {
    const run = deriveAtRiskRun(3, [
      { scheduled_date: "2026-06-26", completed_at: null },
      { scheduled_date: "2026-06-12", completed_at: "2026-06-12T09:00:00Z" },
      { scheduled_date: "2026-06-19", completed_at: null },
    ]);
    expect(run?.consecutiveMisses).toBe(2);
  });
});

describe("nudge keys + dismissal", () => {
  it("encodes the run identity so recovery + re-miss re-fires", () => {
    const key = atRiskNudgeKey({
      participant_id: 7,
      first_miss_date: "2026-06-19",
      consecutiveMisses: 2,
    });
    expect(key).toBe("at_risk:7:2026-06-19");
  });

  it("scopes dismissals per pod", () => {
    const dismissed = new Set(["4:at_risk:7:2026-06-19"]);
    expect(isDismissed(dismissed, 4, "at_risk:7:2026-06-19")).toBe(true);
    expect(isDismissed(dismissed, 5, "at_risk:7:2026-06-19")).toBe(false);
  });
});
