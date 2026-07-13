import { describe, expect, it } from "vitest";
import {
  phaseRowsFromConfig,
  deriveRegistrationWindow,
} from "./schedule";

/* Cycle 3 shape (naive-UTC storage convention; ET intent in comments). */
const CYCLE3 = {
  problem_statement_open: "2026-07-25T13:00:00", // 9 AM ET
  problem_statement_close: "2026-07-25T16:00:00", // noon ET
  voting_open: "2026-07-25T16:00:00",
  voting_close: "2026-07-25T17:00:00",
  pod_registration_open: "2026-07-25T17:00:00", // forming
  pod_registration_close: "2026-07-29T03:59:00", // Jul 28 11:59 PM ET
  solution_proposal_open: "2026-08-13T13:00:00",
  solution_proposal_close: "2026-08-19T03:59:00",
  solution_voting_open: "2026-08-19T04:00:00",
  solution_voting_close: "2026-08-21T03:59:00",
  project_registration_open: "2026-08-21T04:00:00",
  project_registration_close: "2026-08-26T03:59:00", // Aug 25 11:59 PM ET
  phase_2_start: "2026-08-11T22:00:00", // Meet the Pods, 6 PM ET
  phase_3_start: "2026-09-08T22:00:00",
};

describe("phaseRowsFromConfig", () => {
  it("derives six spine phases + the active-join overlay from Cycle 3", () => {
    const rows = phaseRowsFromConfig(CYCLE3);
    expect(rows).toHaveLength(7);

    const forming = rows.find((r) => r.phase_key === "pod_forming")!;
    expect(forming.kind).toBe("spine");
    expect(forming.position).toBe(3);
    expect(forming.starts_at).toBe("2026-07-25T17:00:00.000Z");
    expect(forming.ends_at).toBe("2026-07-29T03:59:00.000Z");

    const aj = rows.find((r) => r.phase_key === "pod_active_join")!;
    expect(aj.kind).toBe("overlay");
    expect(aj.position).toBeNull();
    expect(aj.starts_at).toBe("2026-08-11T22:00:00.000Z"); // = phase_2_start
    expect(aj.ends_at).toBe("2026-08-26T03:59:00.000Z"); // = project reg close
  });

  it("skips pairs with a missing or inverted bound", () => {
    const rows = phaseRowsFromConfig({
      ...CYCLE3,
      voting_open: null,
      solution_voting_open: "2026-08-22T00:00:00", // after its close
    });
    const keys = rows.map((r) => r.phase_key);
    expect(keys).not.toContain("voting");
    expect(keys).not.toContain("solution_voting");
    expect(keys).toContain("problem_statement");
  });

  it("omits the overlay when its anchors are absent", () => {
    const rows = phaseRowsFromConfig({ ...CYCLE3, phase_2_start: null });
    expect(rows.map((r) => r.phase_key)).not.toContain("pod_active_join");
  });

  it("yields nothing for an empty config (org cycles)", () => {
    expect(phaseRowsFromConfig({})).toHaveLength(0);
  });
});

describe("deriveRegistrationWindow (D-10)", () => {
  const forming = Date.parse("2026-07-29T03:59:00Z"); // forming closes
  const ajStart = Date.parse("2026-08-11T22:00:00Z"); // Meet the Pods
  const ajEnd = Date.parse("2026-08-26T03:59:00Z"); // active-join closes
  const bounds = {
    formingEndMs: forming,
    activeJoinStartMs: ajStart,
    activeJoinEndMs: ajEnd,
  };
  const at = (iso: string) => Date.parse(iso);

  it("open from cycle open through forming close", () => {
    expect(deriveRegistrationWindow(bounds, at("2026-07-15T00:00:00Z"))).toEqual({
      open: true,
      state: "open",
      reopensAt: null,
    });
    // inclusive at the boundary
    expect(deriveRegistrationWindow(bounds, forming).open).toBe(true);
  });

  it("closed across the dead zone, naming the reopen instant", () => {
    const w = deriveRegistrationWindow(bounds, at("2026-08-01T00:00:00Z"));
    expect(w.open).toBe(false);
    expect(w.state).toBe("dead_zone");
    expect(w.reopensAt?.getTime()).toBe(ajStart);
  });

  it("open again for the whole active-join window", () => {
    expect(
      deriveRegistrationWindow(bounds, at("2026-08-15T00:00:00Z"))
    ).toEqual({ open: true, state: "active_join", reopensAt: null });
    expect(deriveRegistrationWindow(bounds, ajEnd).open).toBe(true);
  });

  it("closed after active-join ends", () => {
    const w = deriveRegistrationWindow(bounds, at("2026-09-01T00:00:00Z"));
    expect(w).toEqual({ open: false, state: "closed", reopensAt: null });
  });

  it("no forming bound configured → legacy open behavior", () => {
    expect(
      deriveRegistrationWindow(
        { formingEndMs: null, activeJoinStartMs: null, activeJoinEndMs: null },
        at("2026-09-01T00:00:00Z")
      ).open
    ).toBe(true);
  });

  it("forming closed with no active-join bounds → closed, no reopen date", () => {
    const w = deriveRegistrationWindow(
      { formingEndMs: forming, activeJoinStartMs: null, activeJoinEndMs: null },
      at("2026-08-01T00:00:00Z")
    );
    expect(w).toEqual({ open: false, state: "closed", reopensAt: null });
  });
});
