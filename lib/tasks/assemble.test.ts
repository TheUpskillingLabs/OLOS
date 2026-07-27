import { describe, it, expect } from "vitest";
import { assembleTasks, type TaskInputs } from "./assemble";
import { CHECKLIST_HIDE_KEY } from "./definitions";
import { windowTaskKey, setupTaskKey } from "./keys";
import type { WindowState } from "@/lib/cycles/windows";

const openWindow = (
  key: WindowState["key"],
  closesAt = "2026-08-03 17:00:00"
): WindowState => ({
  key,
  open: true,
  opensAt: "2026-07-01 09:00:00",
  closesAt,
});

const baseInputs = (overrides: Partial<TaskInputs> = {}): TaskInputs => ({
  profileDone: false,
  followsAnyone: false,
  slackRowVisible: true,
  activeCycle: { id: 14, name: "Cycle 14" },
  registerCycle: null,
  registerOpen: false,
  registerDone: true,
  windowStates: [],
  myPodCount: 0,
  podLimit: 1,
  logCount: 3,
  pendingBaseline: null,
  gate: { active: false, pending: [] },
  leadershipDue: [],
  fieldSurvey: null,
  surveyContributed: false,
  whatsNext: null,
  dismissedKeys: new Set<string>(),
  ...overrides,
});

const queueIds = (input: TaskInputs) =>
  assembleTasks(input)
    .filter((t) => t.surface === "queue")
    .map((t) => t.defId);

describe("assembleTasks — the gate", () => {
  it("emits the blocking gate task first in every state", () => {
    const input = baseInputs({
      gate: {
        active: true,
        pending: [
          { cycleId: 14, cycleName: "Cycle 14", mode: "open", dueAt: "2026-07-24T00:00:00" },
        ],
      },
      windowStates: [openWindow("voting")],
      whatsNext: { cycleId: 14, week: 5, message: "Meet your pod." },
    });
    const queue = assembleTasks(input).filter((t) => t.surface === "queue");
    expect(queue[0].kind).toBe("weekly_log");
    expect(queue[0].blocking).toBe(true);
    expect(queue[0].dismissible).toBe(false);
    // Windows still emitted below it.
    expect(queue.map((t) => t.kind)).toContain("window");
  });

  it("gate task is never removed by a (forged) dismissal", () => {
    const input = baseInputs({
      gate: {
        active: true,
        pending: [
          { cycleId: 14, cycleName: "Cycle 14", mode: "open", dueAt: "2026-07-24T00:00:00" },
        ],
      },
      dismissedKeys: new Set(["weekly_log:c14:2026-07-24T00:00:00"]),
    });
    expect(queueIds(input)).toContain("weekly_log");
  });

  it("suppresses the first-log nudge while the gate is active", () => {
    const gated = baseInputs({
      logCount: 0,
      gate: {
        active: true,
        pending: [
          { cycleId: 14, cycleName: "Cycle 14", mode: "open", dueAt: "2026-07-24T00:00:00" },
        ],
      },
    });
    expect(queueIds(gated)).not.toContain("first_log");
    const ungated = baseInputs({ logCount: 0 });
    expect(queueIds(ungated)).toContain("first_log");
  });
});

describe("assembleTasks — windows", () => {
  it("emits only open windows, sorted by close instant", () => {
    const input = baseInputs({
      windowStates: [
        openWindow("solution_proposal", "2026-08-10 17:00:00"),
        openWindow("voting", "2026-08-03 17:00:00"),
        { key: "project_registration", open: false, opensAt: null, closesAt: null },
      ],
    });
    const windows = assembleTasks(input).filter((t) => t.kind === "window");
    expect(windows.map((t) => t.defId)).toEqual([
      "window:voting",
      "window:solution_proposal",
    ]);
    expect(windows[0].title).toBe("Vote on problem situations");
    expect(windows[0].deadline).toBe("2026-08-03 17:00:00");
  });

  it("a dismissed window stays hidden this cycle but re-fires next cycle", () => {
    const dismissed = new Set([windowTaskKey("voting", 14)]);
    const thisCycle = baseInputs({
      windowStates: [openWindow("voting")],
      dismissedKeys: dismissed,
    });
    expect(queueIds(thisCycle)).not.toContain("window:voting");

    const nextCycle = baseInputs({
      activeCycle: { id: 15, name: "Cycle 15" },
      windowStates: [openWindow("voting")],
      dismissedKeys: dismissed,
    });
    expect(queueIds(nextCycle)).toContain("window:voting");
  });

  it("drops the pod-registration window once the member is at the pod limit", () => {
    const input = baseInputs({
      windowStates: [openWindow("pod_registration")],
      myPodCount: 1,
      podLimit: 1,
    });
    expect(queueIds(input)).not.toContain("window:pod_registration");
  });

  it("emits no windows with no active cycle", () => {
    const input = baseInputs({
      activeCycle: null,
      windowStates: [openWindow("voting")],
    });
    expect(queueIds(input)).not.toContain("window:voting");
  });
});

describe("assembleTasks — onboarding", () => {
  it("register leads the queue (after the gate) when the D-10 window is open", () => {
    const input = baseInputs({
      registerCycle: { id: 15, name: "Cycle 15", upcoming: true },
      registerOpen: true,
      registerDone: false,
      fieldSurvey: { id: 3, title: "Field survey", shareSlug: "abc" },
    });
    const queue = assembleTasks(input).filter((t) => t.surface === "queue");
    expect(queue[0].kind).toBe("register");
    expect(queue[0].detail).toBe("Pre-register now to claim your spot.");
    expect(queue[0].dismissible).toBe(false);
  });

  it("no register task when the window is closed or already done", () => {
    expect(
      queueIds(
        baseInputs({
          registerCycle: { id: 15, name: "Cycle 15", upcoming: true },
          registerOpen: false,
          registerDone: false,
        })
      )
    ).not.toContain("register");
    expect(
      queueIds(
        baseInputs({
          registerCycle: { id: 15, name: "Cycle 15", upcoming: true },
          registerOpen: true,
          registerDone: true,
        })
      )
    ).not.toContain("register");
  });
});

describe("assembleTasks — survey", () => {
  it("one survey task: contribute before, share after", () => {
    const survey = { id: 3, title: "AI & Work", shareSlug: "abc" };
    const before = baseInputs({ fieldSurvey: survey });
    expect(queueIds(before)).toContain("survey_contribute");
    expect(queueIds(before)).not.toContain("survey_share");

    const after = baseInputs({ fieldSurvey: survey, surveyContributed: true });
    expect(queueIds(after)).toContain("survey_share");
    expect(queueIds(after)).not.toContain("survey_contribute");
  });

  it("the share nudge is dismissible per survey", () => {
    const survey = { id: 3, title: "AI & Work", shareSlug: "abc" };
    const input = baseInputs({
      fieldSurvey: survey,
      surveyContributed: true,
      dismissedKeys: new Set(["survey_share:s3"]),
    });
    expect(queueIds(input)).not.toContain("survey_share");
  });
});

describe("assembleTasks — whats_next", () => {
  it("dismissal is keyed to (cycle, week) so it auto-expires on rollover", () => {
    const week5 = baseInputs({
      whatsNext: { cycleId: 14, week: 5, message: "Meet your pod." },
      dismissedKeys: new Set(["whats_next:c14:w5"]),
    });
    expect(queueIds(week5)).not.toContain("whats_next");

    const week6 = baseInputs({
      whatsNext: { cycleId: 14, week: 6, message: "Ship an experiment." },
      dismissedKeys: new Set(["whats_next:c14:w5"]),
    });
    expect(queueIds(week6)).toContain("whats_next");
  });
});

describe("assembleTasks — checklist", () => {
  it("is account housekeeping only: profile, follow, slack", () => {
    const rows = assembleTasks(baseInputs()).filter(
      (t) => t.surface === "checklist"
    );
    expect(rows.map((t) => t.defId)).toEqual([
      "setup:profile",
      "setup:follow",
      "setup:slack",
    ]);
    expect(rows.every((t) => t.kind === "setup")).toBe(true);
  });

  it("done rows are kept (strikethrough rendering), not dropped", () => {
    const rows = assembleTasks(baseInputs({ profileDone: true })).filter(
      (t) => t.surface === "checklist"
    );
    expect(rows.find((t) => t.defId === "setup:profile")?.done).toBe(true);
  });

  it("the Slack row's done state is its dismissal row (issue #189)", () => {
    const rows = assembleTasks(
      baseInputs({ dismissedKeys: new Set([setupTaskKey("slack")]) })
    ).filter((t) => t.surface === "checklist");
    expect(rows.find((t) => t.defId === "setup:slack")?.done).toBe(true);
  });

  it("pre-Slack-row members never see the row", () => {
    const rows = assembleTasks(baseInputs({ slackRowVisible: false })).filter(
      (t) => t.surface === "checklist"
    );
    expect(rows.map((t) => t.defId)).toEqual(["setup:profile", "setup:follow"]);
  });

  it("the whole checklist disappears once hidden via its key", () => {
    const rows = assembleTasks(
      baseInputs({ dismissedKeys: new Set([CHECKLIST_HIDE_KEY]) })
    ).filter((t) => t.surface === "checklist");
    expect(rows).toEqual([]);
  });
});

describe("assembleTasks — ordering", () => {
  it("follows the priority contract: gate, register, start-here, windows, leadership, share, nudge", () => {
    const input = baseInputs({
      gate: {
        active: true,
        pending: [
          { cycleId: 14, cycleName: "Cycle 14", mode: "open", dueAt: "2026-07-24T00:00:00" },
        ],
      },
      registerCycle: { id: 14, name: "Cycle 14", upcoming: false },
      registerOpen: true,
      registerDone: false,
      pendingBaseline: { id: 14, name: "Cycle 14" },
      windowStates: [openWindow("voting")],
      leadershipDue: [{ tier: "lab_lead", cycleId: 2, podId: null, labId: 4 }],
      fieldSurvey: { id: 3, title: "AI & Work", shareSlug: "abc" },
      surveyContributed: true,
      whatsNext: { cycleId: 14, week: 5, message: "Meet your pod." },
    });
    expect(queueIds(input)).toEqual([
      "weekly_log",
      "register",
      "baseline",
      "window:voting",
      "leadership_log",
      "survey_share",
      "whats_next",
    ]);
  });

  it("is deterministic on equal priorities (defId tiebreak)", () => {
    const input = baseInputs({
      windowStates: [
        openWindow("voting", "2026-08-03 17:00:00"),
        openWindow("solution_voting", "2026-08-03 17:00:00"),
      ],
    });
    const windows = assembleTasks(input).filter((t) => t.kind === "window");
    expect(windows.map((t) => t.defId)).toEqual([
      "window:solution_voting",
      "window:voting",
    ]);
  });
});
