import { describe, it, expect } from "vitest";
import {
  CYCLE_WINDOWS,
  resolveWindowStates,
  nextUpcomingWindow,
  type WindowPhaseRow,
} from "./windows";

const NOW = new Date("2026-07-15T12:00:00Z");

const phaseRow = (
  phase_key: string,
  starts_at: string,
  ends_at: string
): WindowPhaseRow => ({ phase_key, starts_at, ends_at });

describe("CYCLE_WINDOWS registry", () => {
  it("carries the six windows in position order", () => {
    expect(CYCLE_WINDOWS.map((w) => w.key)).toEqual([
      "problem_statement",
      "voting",
      "pod_registration",
      "solution_proposal",
      "solution_voting",
      "project_registration",
    ]);
    expect(CYCLE_WINDOWS.map((w) => w.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("pins the field→phase mapping checkWindow authorizes against", () => {
    // lib/auth/windows.ts derives FIELD_TO_PHASE from these — a drift here
    // would let display and write authorization disagree.
    const mapping = Object.fromEntries(
      CYCLE_WINDOWS.map((w) => [w.key, w.phaseKey])
    );
    expect(mapping).toEqual({
      problem_statement: "problem_statement",
      voting: "voting",
      pod_registration: "pod_forming",
      solution_proposal: "solution_proposal",
      solution_voting: "solution_voting",
      project_registration: "project_registration",
    });
  });

  it("derives open/close fields from the key", () => {
    for (const w of CYCLE_WINDOWS) {
      expect(w.openField).toBe(`${w.key}_open`);
      expect(w.closeField).toBe(`${w.key}_close`);
    }
  });
});

describe("resolveWindowStates — phases path", () => {
  it("is open within [starts_at, ends_at)", () => {
    const phases = [
      phaseRow("voting", "2026-07-10T00:00:00Z", "2026-07-20T00:00:00Z"),
    ];
    const states = resolveWindowStates(phases, null, NOW);
    expect(states.find((s) => s.key === "voting")?.open).toBe(true);
  });

  it("treats ends_at as EXCLUSIVE (matching checkWindow)", () => {
    const phases = [
      phaseRow("voting", "2026-07-10T00:00:00Z", "2026-07-15T12:00:00Z"),
    ];
    const states = resolveWindowStates(phases, null, NOW);
    expect(states.find((s) => s.key === "voting")?.open).toBe(false);
  });

  it("phases win over a contradictory legacy pair", () => {
    const phases = [
      phaseRow("voting", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z"),
    ];
    const config = {
      voting_open: "2026-07-10 00:00:00",
      voting_close: "2026-07-20 00:00:00",
    };
    const states = resolveWindowStates(phases, config, NOW);
    // Legacy says open; the phase row says not yet — phases win.
    expect(states.find((s) => s.key === "voting")?.open).toBe(false);
  });

  it("maps pod_registration onto the pod_forming phase row", () => {
    const phases = [
      phaseRow("pod_forming", "2026-07-10T00:00:00Z", "2026-07-20T00:00:00Z"),
    ];
    const states = resolveWindowStates(phases, null, NOW);
    expect(states.find((s) => s.key === "pod_registration")?.open).toBe(true);
  });
});

describe("resolveWindowStates — legacy config path", () => {
  it("is open within [open, close] INCLUSIVE (the windowOpen contract)", () => {
    const config = {
      voting_open: "2026-07-10 00:00:00",
      voting_close: "2026-07-15 12:00:00", // == NOW exactly
    };
    const states = resolveWindowStates(null, config, NOW);
    expect(states.find((s) => s.key === "voting")?.open).toBe(true);
  });

  it("a missing pair yields closed with null bounds", () => {
    const states = resolveWindowStates(null, {}, NOW);
    for (const s of states) {
      expect(s.open).toBe(false);
      expect(s.opensAt).toBeNull();
      expect(s.closesAt).toBeNull();
    }
  });

  it("naive timestamps parse as UTC instants", () => {
    const config = {
      voting_open: "2026-07-15 11:00:00",
      voting_close: "2026-07-15 13:00:00",
    };
    const states = resolveWindowStates(null, config, NOW);
    expect(states.find((s) => s.key === "voting")?.open).toBe(true);
  });
});

describe("nextUpcomingWindow", () => {
  it("returns the nearest not-yet-open window", () => {
    const config = {
      voting_open: "2026-07-20 00:00:00",
      voting_close: "2026-07-25 00:00:00",
      solution_proposal_open: "2026-08-01 00:00:00",
      solution_proposal_close: "2026-08-10 00:00:00",
    };
    const states = resolveWindowStates(null, config, NOW);
    expect(nextUpcomingWindow(states, NOW)?.key).toBe("voting");
  });

  it("returns null when nothing is scheduled ahead", () => {
    const config = {
      voting_open: "2026-07-01 00:00:00",
      voting_close: "2026-07-05 00:00:00",
    };
    const states = resolveWindowStates(null, config, NOW);
    expect(nextUpcomingWindow(states, NOW)).toBeNull();
  });
});
