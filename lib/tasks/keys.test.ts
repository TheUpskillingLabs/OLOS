import { describe, it, expect } from "vitest";
import {
  isValidTaskKey,
  windowTaskKey,
  weeklyLogTaskKey,
  setupTaskKey,
  cycleSetupTaskKey,
  surveyContributeTaskKey,
  surveyShareTaskKey,
  whatsNextTaskKey,
  leadershipLogTaskKey,
  TASK_KEY_MAX_LENGTH,
} from "./keys";

describe("task key builders", () => {
  it("encodes the occurrence scope each task recurs on", () => {
    expect(windowTaskKey("voting", 14)).toBe("window:voting:c14");
    expect(weeklyLogTaskKey(14, "2026-07-03T00:00:00Z")).toBe(
      "weekly_log:c14:2026-07-03T00:00:00Z"
    );
    expect(setupTaskKey("profile")).toBe("setup:profile");
    expect(cycleSetupTaskKey("register", 15)).toBe("setup:register:c15");
    expect(surveyContributeTaskKey(3)).toBe("survey_contribute:s3");
    expect(surveyShareTaskKey(3)).toBe("survey_share:s3");
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
      surveyContributeTaskKey(12),
      surveyShareTaskKey(12),
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
