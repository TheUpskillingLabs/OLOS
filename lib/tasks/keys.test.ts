import { describe, it, expect } from "vitest";
import {
  isValidTaskKey,
  windowTaskKey,
  weeklyLogTaskKey,
  setupTaskKey,
  cycleSetupTaskKey,
  whatsNextTaskKey,
  leadershipLogTaskKey,
  TASK_KEY_MAX_LENGTH,
  prepareTaskKey,
  prepareSkipKey,
  openNowTaskKey,
} from "./keys";

describe("task key builders", () => {
  it("encodes the occurrence scope each task recurs on", () => {
    expect(windowTaskKey("voting", 14)).toBe("window:voting:c14");
    expect(weeklyLogTaskKey(14, "2026-07-03T00:00:00Z")).toBe(
      "weekly_log:c14:2026-07-03T00:00:00Z"
    );
    expect(setupTaskKey("profile")).toBe("setup:profile");
    expect(cycleSetupTaskKey("register", 15)).toBe("setup:register:c15");
    expect(whatsNextTaskKey(14, 5)).toBe("whats_next:c14:w5");
    expect(leadershipLogTaskKey("workstream_lead", 2, 7, null)).toBe(
      "leadership_log:workstream_lead:c2:p7"
    );
    expect(leadershipLogTaskKey("lab_lead", 2, null, 4)).toBe(
      "leadership_log:lab_lead:c2:l4"
    );
  });

  it("rotates the window key across cycles (the re-fire contract)", () => {
    // The cross-cycle dismissal bug fix: same window, new cycle → new key.
    expect(windowTaskKey("voting", 14)).not.toBe(windowTaskKey("voting", 15));
  });

  it("rotates the whats_next key across weeks", () => {
    expect(whatsNextTaskKey(14, 5)).not.toBe(whatsNextTaskKey(14, 6));
  });

  it("every builder output passes the grammar", () => {
    const keys = [
      windowTaskKey("project_registration", 999),
      weeklyLogTaskKey(1, "2026-07-03T00:00:00.000Z"),
      weeklyLogTaskKey(1, "2026-07-03 00:00:00"),
      setupTaskKey("first_log"),
      cycleSetupTaskKey("baseline", 8),
      whatsNextTaskKey(14, 0),
      leadershipLogTaskKey("lab_lead", 3, null, 9),
    ];
    for (const k of keys) expect(isValidTaskKey(k), k).toBe(true);
  });

  it("rejects junk", () => {
    expect(isValidTaskKey("")).toBe(false);
    expect(isValidTaskKey("UPPERCASE:kind")).toBe(false);
    expect(isValidTaskKey("window voting")).toBe(false);
    expect(isValidTaskKey("window:voting;drop table")).toBe(false);
    expect(isValidTaskKey("a".repeat(TASK_KEY_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("readiness and open-now keys (#412/#413)", () => {
  it("scopes account steps to the account and cycle steps to the cycle", () => {
    expect(prepareTaskKey("slack")).toBe("prepare:slack");
    expect(prepareTaskKey("assistant")).toBe("prepare:assistant");
    expect(prepareTaskKey("videos")).toBe("prepare:videos");
    expect(prepareTaskKey("dates", 16)).toBe("prepare:dates:c16");
    expect(prepareTaskKey("primer", 16)).toBe("prepare:primer:c16");
    expect(prepareTaskKey("dates", 16)).not.toBe(prepareTaskKey("dates", 17));
  });

  it("refuses a cycle-scoped step without a cycle", () => {
    expect(() => prepareTaskKey("dates")).toThrow();
    expect(() => prepareTaskKey("primer", null)).toThrow();
  });

  it("keeps the skip on its own key so un-skipping never removes a tick", () => {
    expect(prepareSkipKey("assistant")).toBe("prepare:assistant:skip");
    expect(prepareSkipKey("primer", 16)).toBe("prepare:primer:c16:skip");
    expect(prepareSkipKey("slack")).not.toBe(prepareTaskKey("slack"));
  });

  it("names open-now rows by kind and source id", () => {
    expect(openNowTaskKey("library")).toBe("open_now:library");
    expect(openNowTaskKey("event", "prompting-101")).toBe("open_now:event:prompting-101");
    expect(openNowTaskKey("look_back", 15)).toBe("open_now:look_back:15");
  });

  it("every new builder output passes the grammar", () => {
    const keys = [
      prepareTaskKey("slack"),
      prepareTaskKey("dates", 3),
      prepareSkipKey("primer", 3),
      prepareSkipKey("videos"),
      openNowTaskKey("event", "a-slug.v2"),
      openNowTaskKey("survey", 7),
    ];
    for (const k of keys) expect(isValidTaskKey(k), k).toBe(true);
  });
});
