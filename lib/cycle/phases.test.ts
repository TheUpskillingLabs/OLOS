import { describe, it, expect } from "vitest";
import {
  resolveCycleTimeline,
  resolveCurrentPhase,
  CYCLE_PHASES,
  type CycleConfigPhaseColumns,
} from "./phases";

const NOW = new Date("2026-06-15T12:00:00Z");
const iso = (d: string) => new Date(d).toISOString();

// A config where problem_statement + voting are done, pod_registration is open,
// solution_proposal is upcoming, and the last two are unscheduled.
function baseConfig(): CycleConfigPhaseColumns {
  return {
    problem_statement_open: iso("2026-06-01T00:00:00Z"),
    problem_statement_close: iso("2026-06-05T00:00:00Z"),
    voting_open: iso("2026-06-06T00:00:00Z"),
    voting_close: iso("2026-06-10T00:00:00Z"),
    pod_registration_open: iso("2026-06-14T00:00:00Z"),
    pod_registration_close: iso("2026-06-20T00:00:00Z"),
    solution_proposal_open: iso("2026-06-25T00:00:00Z"),
    solution_proposal_close: iso("2026-06-30T00:00:00Z"),
    solution_voting_open: null,
    solution_voting_close: null,
    project_registration_open: null,
    project_registration_close: null,
  };
}

describe("resolveCycleTimeline", () => {
  it("classifies done / open / upcoming / unscheduled", () => {
    const { phases } = resolveCycleTimeline(baseConfig(), NOW);
    const byField = Object.fromEntries(phases.map((p) => [p.field, p.state]));
    expect(byField.problem_statement).toBe("done");
    expect(byField.voting).toBe("done");
    expect(byField.pod_registration).toBe("open");
    expect(byField.solution_proposal).toBe("upcoming");
    expect(byField.solution_voting).toBe("unscheduled");
    expect(byField.project_registration).toBe("unscheduled");
  });

  it("picks current = the open phase and next = the nearest upcoming", () => {
    const { current, next } = resolveCycleTimeline(baseConfig(), NOW);
    expect(current?.field).toBe("pod_registration");
    expect(next?.field).toBe("solution_proposal");
  });

  it("returns all six phases in order", () => {
    const { phases } = resolveCycleTimeline(baseConfig(), NOW);
    expect(phases.map((p) => p.field)).toEqual(CYCLE_PHASES.map((p) => p.field));
  });

  it("treats the open and close instants as inclusive (open)", () => {
    const cfg = baseConfig();
    const atOpen = new Date(cfg.pod_registration_open as string);
    const atClose = new Date(cfg.pod_registration_close as string);
    expect(
      resolveCycleTimeline(cfg, atOpen).phases.find((p) => p.field === "pod_registration")?.state
    ).toBe("open");
    expect(
      resolveCycleTimeline(cfg, atClose).phases.find((p) => p.field === "pod_registration")?.state
    ).toBe("open");
  });

  it("has no current and no next once every window has closed", () => {
    const cfg = baseConfig();
    const after = new Date("2026-08-01T00:00:00Z");
    const { current, next, phases } = resolveCycleTimeline(cfg, after);
    expect(current).toBeNull();
    expect(next).toBeNull();
    // Scheduled windows are done; unscheduled stay unscheduled.
    expect(phases.find((p) => p.field === "solution_proposal")?.state).toBe("done");
    expect(phases.find((p) => p.field === "solution_voting")?.state).toBe("unscheduled");
  });
});

describe("resolveCurrentPhase (moderator surface, moved here)", () => {
  it("returns the active phase with a display name", () => {
    const phase = resolveCurrentPhase(baseConfig(), NOW);
    expect(phase?.num).toBe(3);
    expect(phase?.isActive).toBe(true);
    expect(phase?.displayName).toBe("Phase 3: Pod Registration");
  });

  it("falls back to the nearest upcoming phase when nothing is open", () => {
    const cfg = baseConfig();
    const beforePods = new Date("2026-06-12T00:00:00Z"); // between voting close and pod open
    const phase = resolveCurrentPhase(cfg, beforePods);
    expect(phase?.num).toBe(3);
    expect(phase?.isActive).toBe(false);
  });
});
