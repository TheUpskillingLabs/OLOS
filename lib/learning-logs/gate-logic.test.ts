import { describe, it, expect } from "vitest";
import { resolveGate, type GateCycleInput } from "./gate-logic";

const openCycle = (overrides: Partial<GateCycleInput> = {}): GateCycleInput => ({
  cycleId: 1,
  cycleName: "Cycle 12",
  mode: "open",
  logDueAt: "2026-07-03T00:00:00Z",
  gatePaused: false,
  hasLogSinceStamp: false,
  ...overrides,
});

const orgCycle = (overrides: Partial<GateCycleInput> = {}): GateCycleInput => ({
  cycleId: 2,
  cycleName: "Q3 Org Cycle",
  mode: "org",
  logDueAt: "2026-07-03T00:00:00Z",
  gatePaused: false,
  hasLogSinceStamp: false,
  ...overrides,
});

describe("resolveGate", () => {
  it("locks on a single armed, unmet cycle", () => {
    const result = resolveGate([openCycle()]);
    expect(result.active).toBe(true);
    expect(result.armed).toBe(true);
    expect(result.pending).toEqual([
      { cycleId: 1, cycleName: "Cycle 12", mode: "open", dueAt: "2026-07-03T00:00:00Z" },
    ]);
  });

  it("clears on a single armed, met cycle", () => {
    const result = resolveGate([openCycle({ hasLogSinceStamp: true })]);
    expect(result.active).toBe(false);
    expect(result.armed).toBe(true);
    expect(result.pending).toEqual([]);
  });

  it("is not armed when the cycle is paused", () => {
    const result = resolveGate([openCycle({ gatePaused: true })]);
    expect(result.active).toBe(false);
    expect(result.armed).toBe(false);
    expect(result.pending).toEqual([]);
  });

  it("is not armed when no stamp has been set", () => {
    const result = resolveGate([openCycle({ logDueAt: null })]);
    expect(result.active).toBe(false);
    expect(result.armed).toBe(false);
    expect(result.pending).toEqual([]);
  });

  it("locks a dual-enrolled member with exactly the unmet cycle pending", () => {
    const result = resolveGate([
      openCycle({ hasLogSinceStamp: true }),
      orgCycle({ hasLogSinceStamp: false }),
    ]);
    expect(result.active).toBe(true);
    expect(result.armed).toBe(true);
    expect(result.pending).toEqual([
      { cycleId: 2, cycleName: "Q3 Org Cycle", mode: "org", dueAt: "2026-07-03T00:00:00Z" },
    ]);
  });

  it("clears a dual-enrolled member once both cycles are met", () => {
    const result = resolveGate([
      openCycle({ hasLogSinceStamp: true }),
      orgCycle({ hasLogSinceStamp: true }),
    ]);
    expect(result.active).toBe(false);
    expect(result.armed).toBe(true);
    expect(result.pending).toEqual([]);
  });

  it("locks an org-only member on a single armed, unmet org cycle", () => {
    const result = resolveGate([orgCycle()]);
    expect(result.active).toBe(true);
    expect(result.armed).toBe(true);
    expect(result.pending).toEqual([
      { cycleId: 2, cycleName: "Q3 Org Cycle", mode: "org", dueAt: "2026-07-03T00:00:00Z" },
    ]);
  });

  it("is inactive on empty input", () => {
    const result = resolveGate([]);
    expect(result.active).toBe(false);
    expect(result.armed).toBe(false);
    expect(result.pending).toEqual([]);
  });
});
