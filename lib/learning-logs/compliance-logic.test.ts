import { describe, it, expect } from "vitest";
import {
  resolveLogCompliance,
  logComplianceCopy,
  complianceRank,
  type LogComplianceInput,
} from "./compliance-logic";

/** A fully compliant baseline: active member, armed window, logged this week,
    no missed weeks. Every case below overrides just the fields it exercises. */
const base: LogComplianceInput = {
  isActiveMember: true,
  armed: true,
  hasLoggedThisWindow: true,
  missedWeeks: 0,
  atRiskThreshold: 2,
};

describe("resolveLogCompliance", () => {
  it("is on_track when the window is met and no weeks are missed", () => {
    const r = resolveLogCompliance(base);
    expect(r.status).toBe("on_track");
    expect(r.nudge).toBe(false);
  });

  it("is not_applicable for a non-active member (even if behind)", () => {
    const r = resolveLogCompliance({
      ...base,
      isActiveMember: false,
      hasLoggedThisWindow: false,
      missedWeeks: 5,
    });
    expect(r.status).toBe("not_applicable");
    expect(r.nudge).toBe(false);
  });

  it("is not_applicable when the cycle window is not armed", () => {
    const r = resolveLogCompliance({
      ...base,
      armed: false,
      hasLoggedThisWindow: false,
      missedWeeks: 3,
    });
    expect(r.status).toBe("not_applicable");
    expect(r.nudge).toBe(false);
  });

  it("is due_now when armed and unmet this week but not behind", () => {
    const r = resolveLogCompliance({ ...base, hasLoggedThisWindow: false });
    expect(r.status).toBe("due_now");
    expect(r.nudge).toBe(true);
  });

  it("is behind at one missed week (threshold 2), even if this week is met", () => {
    // hasLoggedThisWindow true but a prior completed week was missed: the two
    // signals are about different weeks, so a met current window does not erase
    // being behind.
    const r = resolveLogCompliance({ ...base, missedWeeks: 1 });
    expect(r.status).toBe("behind");
    expect(r.nudge).toBe(true);
  });

  it("becomes at_risk once missed weeks reach the threshold", () => {
    const r = resolveLogCompliance({
      ...base,
      hasLoggedThisWindow: false,
      missedWeeks: 2,
    });
    expect(r.status).toBe("at_risk");
    expect(r.nudge).toBe(true);
  });

  it("missed weeks (prior) outrank the current window: at_risk over due_now", () => {
    const r = resolveLogCompliance({
      ...base,
      hasLoggedThisWindow: false,
      missedWeeks: 4,
      atRiskThreshold: 2,
    });
    expect(r.status).toBe("at_risk");
  });

  it("respects a custom threshold: 2 misses is only 'behind' when threshold is 3", () => {
    const r = resolveLogCompliance({
      ...base,
      missedWeeks: 2,
      atRiskThreshold: 3,
    });
    expect(r.status).toBe("behind");
  });

  it("floors a misconfigured threshold of 0 so on-cadence members are not at_risk", () => {
    const r = resolveLogCompliance({ ...base, atRiskThreshold: 0 });
    expect(r.status).toBe("on_track");
  });

  it("with threshold 1, a single miss is at_risk (skips 'behind')", () => {
    const r = resolveLogCompliance({
      ...base,
      missedWeeks: 1,
      atRiskThreshold: 1,
    });
    expect(r.status).toBe("at_risk");
  });
});

describe("complianceRank", () => {
  it("orders most-urgent-first", () => {
    expect(complianceRank("at_risk")).toBeGreaterThan(complianceRank("behind"));
    expect(complianceRank("behind")).toBeGreaterThan(complianceRank("due_now"));
    expect(complianceRank("due_now")).toBeGreaterThan(complianceRank("on_track"));
    expect(complianceRank("on_track")).toBeGreaterThan(
      complianceRank("not_applicable")
    );
  });
});

describe("logComplianceCopy", () => {
  it("returns null for statuses that never nudge", () => {
    expect(
      logComplianceCopy(resolveLogCompliance(base), { cycleName: "Civics" })
    ).toBeNull();
    expect(
      logComplianceCopy(
        resolveLogCompliance({ ...base, isActiveMember: false }),
        { cycleName: "Civics" }
      )
    ).toBeNull();
  });

  it("names the cycle and escalates tone from info to warn", () => {
    const behind = logComplianceCopy(
      resolveLogCompliance({ ...base, missedWeeks: 1 }),
      { cycleName: "Civics & Elections" }
    );
    expect(behind?.tone).toBe("info");
    expect(behind?.headline).toContain("Civics & Elections");

    const atRisk = logComplianceCopy(
      resolveLogCompliance({ ...base, missedWeeks: 2 }),
      { cycleName: "Civics & Elections" }
    );
    expect(atRisk?.tone).toBe("warn");
    expect(atRisk?.body).toContain("2 weeks");
  });

  it("pluralizes the behind copy at exactly one week", () => {
    const behind = logComplianceCopy(
      resolveLogCompliance({ ...base, missedWeeks: 1 }),
      { cycleName: "Civics" }
    );
    expect(behind?.body).toContain("One week");
  });
});
