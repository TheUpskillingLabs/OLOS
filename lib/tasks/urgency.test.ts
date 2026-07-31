import { describe, it, expect } from "vitest";
import {
  deadlineUrgency,
  timeLeftLabel,
  urgencyTextClass,
} from "./urgency";

const NOW = new Date("2026-08-01T12:00:00Z");

describe("deadlineUrgency", () => {
  it("null for no deadline / unparseable / passed", () => {
    expect(deadlineUrgency(null, NOW)).toBeNull();
    expect(deadlineUrgency("", NOW)).toBeNull();
    expect(deadlineUrgency("2026-08-01T11:59:00Z", NOW)).toBeNull();
  });

  it("null when comfortably out (> 3 days)", () => {
    expect(deadlineUrgency("2026-08-05T12:00:01Z", NOW)).toBeNull();
  });

  it("soon within 3 days", () => {
    expect(deadlineUrgency("2026-08-03T12:00:00Z", NOW)).toBe("soon");
    expect(deadlineUrgency("2026-08-04T11:00:00Z", NOW)).toBe("soon");
  });

  it("imminent within 24 hours", () => {
    expect(deadlineUrgency("2026-08-02T11:00:00Z", NOW)).toBe("imminent");
    expect(deadlineUrgency("2026-08-01T12:30:00Z", NOW)).toBe("imminent");
  });

  it("accepts naive-UTC stored strings (the window column convention)", () => {
    expect(deadlineUrgency("2026-08-01 17:00:00", NOW)).toBe("imminent");
  });
});

describe("timeLeftLabel", () => {
  it("null beyond the soon horizon or once passed", () => {
    expect(timeLeftLabel("2026-08-10T12:00:00Z", NOW)).toBeNull();
    expect(timeLeftLabel("2026-08-01T11:00:00Z", NOW)).toBeNull();
    expect(timeLeftLabel(null, NOW)).toBeNull();
  });

  it("counts days, hours, then minutes", () => {
    expect(timeLeftLabel("2026-08-03T14:00:00Z", NOW)).toBe("2 days left");
    expect(timeLeftLabel("2026-08-02T13:00:00Z", NOW)).toBe("1 day left");
    expect(timeLeftLabel("2026-08-01T17:30:00Z", NOW)).toBe("5 hours left");
    expect(timeLeftLabel("2026-08-01T13:00:00Z", NOW)).toBe("1 hour left");
    expect(timeLeftLabel("2026-08-01T12:20:00Z", NOW)).toBe("20 minutes left");
  });
});

describe("urgencyTextClass", () => {
  it("maps tiers inside the canonical palette", () => {
    expect(urgencyTextClass("imminent")).toContain("text-red");
    expect(urgencyTextClass("soon")).toContain("text-teal-deep");
    expect(urgencyTextClass(null)).toBe("");
  });
});
