import { describe, expect, it } from "vitest";
import {
  NEXT_PUBLIC_CYCLE_YEAR,
  nextPublicCycleLine,
  nextPublicCycleYear,
} from "./next-public-cycle";

describe("nextPublicCycleYear", () => {
  it("returns the configured year before it arrives", () => {
    expect(nextPublicCycleYear(new Date("2026-10-03T12:00:00Z"), 2027)).toBe(2027);
  });

  it("still returns the year during that year", () => {
    expect(nextPublicCycleYear(new Date("2027-06-01T12:00:00Z"), 2027)).toBe(2027);
  });

  it("returns null once the year has passed, so a forgotten constant never goes stale", () => {
    expect(nextPublicCycleYear(new Date("2028-01-02T12:00:00Z"), 2027)).toBeNull();
  });

  it("defaults to the configured constant", () => {
    expect(nextPublicCycleYear(new Date("2026-10-03T12:00:00Z"))).toBe(NEXT_PUBLIC_CYCLE_YEAR);
  });
});

describe("nextPublicCycleLine", () => {
  it("names the year while it is ahead", () => {
    expect(nextPublicCycleLine(new Date("2026-10-03T12:00:00Z"), 2027)).toBe(
      "The next public Build Cycle opens in 2027."
    );
  });

  it("falls back to the general sentence after the year", () => {
    expect(nextPublicCycleLine(new Date("2028-03-01T12:00:00Z"), 2027)).toBe(
      "The next public Build Cycle is being planned."
    );
  });

  it("never promises a notification", () => {
    for (const d of ["2026-10-03", "2028-03-01"]) {
      expect(nextPublicCycleLine(new Date(`${d}T12:00:00Z`), 2027)).not.toMatch(
        /email|tell you|notify|let you know/i
      );
    }
  });
});
