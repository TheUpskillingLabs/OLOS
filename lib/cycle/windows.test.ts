import { describe, it, expect } from "vitest";
import {
  CYCLE_WINDOWS,
  openWindows,
  nextWindow,
  type CycleWindowConfig,
} from "./windows";
import { CYCLE_PHASES, phaseForWeek } from "./phases";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-02-10T12:00:00Z");
const iso = (offsetDays: number) =>
  new Date(now.getTime() + offsetDays * DAY_MS).toISOString();

describe("CYCLE_WINDOWS", () => {
  it("carries all six windows in cycle-chronological order", () => {
    expect(CYCLE_WINDOWS.map((w) => w.key)).toEqual([
      "problem_statement",
      "voting",
      "pod_registration",
      "solution_proposal",
      "solution_voting",
      "project_registration",
    ]);
  });

  it("routes match the real /cycles/[id]/* sub-pages", () => {
    expect(CYCLE_WINDOWS.map((w) => w.route)).toEqual([
      "propose",
      "vote",
      "register-pods",
      "solutions",
      "solution-vote",
      "register-projects",
    ]);
  });
});

describe("openWindows", () => {
  it("returns only windows whose interval contains now", () => {
    const config: CycleWindowConfig = {
      problem_statement_open: iso(-2),
      problem_statement_close: iso(2),
      voting_open: iso(3),
      voting_close: iso(5),
    };
    const open = openWindows(config, now);
    expect(open.map((w) => w.key)).toEqual(["problem_statement"]);
    expect(open[0].closesAt).toBe(iso(2));
  });

  it("treats open/close bounds as inclusive", () => {
    const config: CycleWindowConfig = {
      voting_open: now.toISOString(),
      voting_close: now.toISOString(),
    };
    expect(openWindows(config, now).map((w) => w.key)).toEqual(["voting"]);
  });

  it("skips windows with a missing bound and handles an empty config", () => {
    expect(openWindows({ voting_open: iso(-1) }, now)).toEqual([]);
    expect(openWindows({}, now)).toEqual([]);
  });

  it("returns concurrent windows in table order", () => {
    const config: CycleWindowConfig = {
      pod_registration_open: iso(-1),
      pod_registration_close: iso(1),
      voting_open: iso(-1),
      voting_close: iso(1),
    };
    expect(openWindows(config, now).map((w) => w.key)).toEqual([
      "voting",
      "pod_registration",
    ]);
  });
});

describe("nextWindow", () => {
  it("returns the earliest-opening future window, not the first in the table", () => {
    const config: CycleWindowConfig = {
      voting_open: iso(10),
      solution_voting_open: iso(4),
    };
    expect(nextWindow(config, now)?.key).toBe("solution_voting");
  });

  it("ignores already-open and unconfigured windows", () => {
    const config: CycleWindowConfig = {
      problem_statement_open: iso(-1),
      problem_statement_close: iso(1),
    };
    expect(nextWindow(config, now)).toBeNull();
    expect(nextWindow({}, now)).toBeNull();
  });
});

describe("phases", () => {
  it("covers the 0–12 rail with three phases", () => {
    expect(CYCLE_PHASES.map((p) => p.num)).toEqual([1, 2, 3]);
    expect(CYCLE_PHASES.every((p) => p.blurb.length > 0)).toBe(true);
  });

  it("phaseForWeek matches the indicator's boundaries", () => {
    expect(phaseForWeek(-1)).toBe(0);
    expect(phaseForWeek(0)).toBe(1);
    expect(phaseForWeek(3)).toBe(1);
    expect(phaseForWeek(4)).toBe(2);
    expect(phaseForWeek(7)).toBe(2);
    expect(phaseForWeek(8)).toBe(3);
    expect(phaseForWeek(12)).toBe(3);
  });
});
