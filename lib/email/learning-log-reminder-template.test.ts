import { describe, it, expect } from "vitest";
import {
  formatCycleList,
  logReminderSubject,
} from "./learning-log-reminder-template";

describe("formatCycleList", () => {
  it("renders a single name bare", () => {
    expect(formatCycleList(["Energy & Climate"])).toBe("Energy & Climate");
  });

  it("joins two names with 'and', no comma", () => {
    expect(formatCycleList(["Energy & Climate", "Labs Summer 2026"])).toBe(
      "Energy & Climate and Labs Summer 2026"
    );
  });

  it("Oxford-commas three or more names", () => {
    expect(
      formatCycleList(["Energy & Climate", "Labs Summer 2026", "Civics HQ"])
    ).toBe("Energy & Climate, Labs Summer 2026, and Civics HQ");
  });

  it("returns an empty string for no names", () => {
    expect(formatCycleList([])).toBe("");
  });
});

describe("logReminderSubject", () => {
  it("names a single due cycle", () => {
    expect(logReminderSubject(["Energy & Climate"])).toBe(
      "Your Learning Log for Energy & Climate is due"
    );
  });

  it("names two due cycles", () => {
    expect(
      logReminderSubject(["Energy & Climate", "Labs Summer 2026"])
    ).toBe(
      "Your Learning Log for Energy & Climate and Labs Summer 2026 is due"
    );
  });
});
