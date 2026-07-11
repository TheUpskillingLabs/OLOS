import { describe, it, expect } from "vitest";
import {
  resolveLeadershipScopes,
  type LeadershipScopeInput,
} from "./tier-logic";

// Wednesday 2026-01-07 13:00 UTC — the arm stamp used across these cases.
const WED = "2026-01-07T13:00:00.000Z";
const THU = new Date("2026-01-08T14:00:00.000Z");
const FRI = new Date("2026-01-09T14:00:00.000Z");
const WED_EVENING = new Date("2026-01-07T20:00:00.000Z");

const wsScope = (over: Partial<LeadershipScopeInput> = {}): LeadershipScopeInput => ({
  tier: "workstream_lead",
  cycleId: 10,
  cycleName: "Org Q1",
  podId: 5,
  labId: null,
  scopeLabel: "Baltimore Ops",
  leadershipLogDueAt: WED,
  gatePaused: false,
  submittedThisWeek: false,
  ...over,
});
const labScope = (over: Partial<LeadershipScopeInput> = {}): LeadershipScopeInput => ({
  tier: "lab_lead",
  cycleId: 10,
  cycleName: "Org Q1",
  podId: null,
  labId: 2,
  scopeLabel: "Baltimore",
  leadershipLogDueAt: WED,
  gatePaused: false,
  submittedThisWeek: false,
  ...over,
});

describe("resolveLeadershipScopes", () => {
  it("armed + unsubmitted ⇒ due", () => {
    const [s] = resolveLeadershipScopes([wsScope()], THU);
    expect(s.armed).toBe(true);
    expect(s.due).toBe(true);
  });

  it("submitted this week ⇒ not due", () => {
    const [s] = resolveLeadershipScopes([wsScope({ submittedThisWeek: true })], THU);
    expect(s.armed).toBe(true);
    expect(s.due).toBe(false);
  });

  it("no stamp ⇒ not armed, nothing due (never 'everything overdue')", () => {
    const [s] = resolveLeadershipScopes([wsScope({ leadershipLogDueAt: null })], THU);
    expect(s.armed).toBe(false);
    expect(s.due).toBe(false);
  });

  it("paused ⇒ not armed, nothing due", () => {
    const [s] = resolveLeadershipScopes([wsScope({ gatePaused: true })], THU);
    expect(s.armed).toBe(false);
    expect(s.due).toBe(false);
  });

  it("workstream_lead target day is Thursday (stamp + 1)", () => {
    const wed = resolveLeadershipScopes([wsScope()], WED_EVENING)[0];
    const thu = resolveLeadershipScopes([wsScope()], THU)[0];
    expect(wed.targetDay).toBe("Thursday");
    expect(wed.dueDayPassed).toBe(false); // still Wednesday
    expect(thu.dueDayPassed).toBe(true); // Thursday reached
  });

  it("lab_lead target day is Friday (stamp + 2)", () => {
    const thu = resolveLeadershipScopes([labScope()], THU)[0];
    const fri = resolveLeadershipScopes([labScope()], FRI)[0];
    expect(fri.targetDay).toBe("Friday");
    expect(thu.dueDayPassed).toBe(false); // Thursday — lab lead's day not yet
    expect(fri.dueDayPassed).toBe(true); // Friday reached
  });

  it("keeps distinct scopes independent (multi-scope person)", () => {
    const out = resolveLeadershipScopes(
      [
        wsScope({ podId: 5, submittedThisWeek: true }),
        wsScope({ podId: 6, submittedThisWeek: false }),
        labScope({ submittedThisWeek: false }),
      ],
      FRI
    );
    expect(out.map((s) => s.due)).toEqual([false, true, true]);
    expect(out.map((s) => s.podId ?? s.labId)).toEqual([5, 6, 2]);
  });
});
