import { describe, it, expect } from "vitest";
import { getCyclePhase } from "./phase";

// A 13-week cycle: wk0 starts Jan 5, ends Apr 5 (91 days → 7 days/week).
const cycle = { start_date: "2026-01-05T00:00:00Z", end_date: "2026-04-06T00:00:00Z" };
const at = (iso: string) => new Date(iso);

describe("getCyclePhase — admin stamps set", () => {
  // Naive-UTC stamps (S5.1): stored without zone, meaning the instant in UTC.
  const config = {
    phase_2_start: "2026-02-02 00:00:00",
    phase_3_start: "2026-03-09 00:00:00",
  };

  it("before phase_2_start → 1", () => {
    expect(getCyclePhase(at("2026-01-20T12:00:00Z"), cycle, config)).toBe(1);
  });

  it("exactly at phase_2_start → 2 (boundary belongs to the new phase)", () => {
    expect(getCyclePhase(at("2026-02-02T00:00:00Z"), cycle, config)).toBe(2);
  });

  it("between the stamps → 2", () => {
    expect(getCyclePhase(at("2026-02-20T00:00:00Z"), cycle, config)).toBe(2);
  });

  it("at/after phase_3_start → 3", () => {
    expect(getCyclePhase(at("2026-03-09T00:00:00Z"), cycle, config)).toBe(3);
    expect(getCyclePhase(at("2026-04-01T00:00:00Z"), cycle, config)).toBe(3);
  });

  it("parses naive-UTC stamps as UTC instants (not runtime-local)", () => {
    // One second before the naive-UTC stamp must still be phase 1 regardless
    // of the runtime's local zone — parseWindow appends Z.
    expect(getCyclePhase(at("2026-02-01T23:59:59Z"), cycle, config)).toBe(1);
  });
});

describe("getCyclePhase — fallback week thresholds (stamps missing)", () => {
  it.each([
    ["2026-01-01T00:00:00Z", 1], // pre-start (wk -1) clamps to 1
    ["2026-01-05T00:00:00Z", 1], // wk 0
    ["2026-01-28T00:00:00Z", 1], // wk 3
    ["2026-02-04T00:00:00Z", 2], // wk 4
    ["2026-02-25T00:00:00Z", 2], // wk 7
    ["2026-03-04T00:00:00Z", 3], // wk 8
    ["2026-04-03T00:00:00Z", 3], // wk 12
    ["2026-05-01T00:00:00Z", 3], // post-end (wk 13) clamps to 3
  ])("%s → phase %i", (iso, phase) => {
    expect(getCyclePhase(at(iso), cycle, null)).toBe(phase);
    expect(
      getCyclePhase(at(iso), cycle, { phase_2_start: null, phase_3_start: null })
    ).toBe(phase);
  });

  it("one stamp set, one missing → still falls back to weeks", () => {
    expect(
      getCyclePhase(at("2026-03-04T00:00:00Z"), cycle, {
        phase_2_start: "2026-02-02 00:00:00",
        phase_3_start: null,
      })
    ).toBe(3);
  });
});
