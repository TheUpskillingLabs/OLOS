import { describe, expect, it } from "vitest";
import {
  betweenCyclesState,
  deriveBetweenCycles,
  type BetweenCyclesInput,
} from "./between-cycles";

const base = (o: Partial<BetweenCyclesInput> = {}): BetweenCyclesInput => ({
  onboarding: true,
  assignmentOnlyPoderator: false,
  orgActive: false,
  hasUpcomingCycle: false,
  hasActiveCycle: false,
  activeRegistrationState: null,
  ...o,
});

describe("deriveBetweenCycles", () => {
  it("S0: no open cycle running and none announced (production from Oct 13 until 2027)", () => {
    expect(deriveBetweenCycles(base())).toBe(true);
  });

  it("S1/S2: an upcoming cycle is announced", () => {
    expect(deriveBetweenCycles(base({ hasUpcomingCycle: true }))).toBe(true);
    expect(
      deriveBetweenCycles(
        base({ hasUpcomingCycle: true, hasActiveCycle: true, activeRegistrationState: "open" })
      )
    ).toBe(true);
  });

  it("S3: a cycle is running but its registration has closed for good", () => {
    expect(
      deriveBetweenCycles(base({ hasActiveCycle: true, activeRegistrationState: "closed" }))
    ).toBe(true);
  });

  it("keeps today's onboarding view while the running cycle can still be joined", () => {
    for (const state of ["open", "active_join"] as const) {
      expect(
        deriveBetweenCycles(base({ hasActiveCycle: true, activeRegistrationState: state }))
      ).toBe(false);
    }
  });

  it("keeps today's view during the dead zone (paused, with a reopen date)", () => {
    expect(
      deriveBetweenCycles(base({ hasActiveCycle: true, activeRegistrationState: "dead_zone" }))
    ).toBe(false);
  });

  it("is never true for an engaged member", () => {
    expect(deriveBetweenCycles(base({ onboarding: false, hasUpcomingCycle: true }))).toBe(false);
  });

  it("is never true for an assignment-only Poderator or an active org-cycle member", () => {
    expect(deriveBetweenCycles(base({ assignmentOnlyPoderator: true }))).toBe(false);
    expect(deriveBetweenCycles(base({ orgActive: true }))).toBe(false);
  });

  it("seeding one upcoming cycle while a running cycle is still joinable flips the member into the mode", () => {
    const running = base({ hasActiveCycle: true, activeRegistrationState: "open" });
    expect(deriveBetweenCycles(running)).toBe(false);
    expect(deriveBetweenCycles({ ...running, hasUpcomingCycle: true })).toBe(true);
  });
});

describe("betweenCyclesState", () => {
  it("names the three member-facing states", () => {
    expect(betweenCyclesState({ hasUpcomingCycle: false, preRegisteredUpcoming: false })).toBe(
      "none_announced"
    );
    expect(betweenCyclesState({ hasUpcomingCycle: true, preRegisteredUpcoming: false })).toBe(
      "announced"
    );
    expect(betweenCyclesState({ hasUpcomingCycle: true, preRegisteredUpcoming: true })).toBe(
      "pre_registered"
    );
  });
});
