import { describe, it, expect } from "vitest";
import { fmtMonth, monthKey } from "./format";

describe("monthKey", () => {
  it("keys by year and zero-padded month", () => {
    expect(monthKey("2026-07-28T18:00:00")).toBe("2026-07");
    expect(monthKey("2026-12-03T09:00:00")).toBe("2026-12");
  });
  it("never merges the same month across years", () => {
    expect(monthKey("2026-01-05T10:00:00")).not.toBe(monthKey("2027-01-05T10:00:00"));
  });
});

describe("fmtMonth", () => {
  it("renders the full month name with the year", () => {
    expect(fmtMonth("2026-07-28T18:00:00")).toBe("July 2026");
    expect(fmtMonth("2027-01-02T08:00:00")).toBe("January 2027");
  });
});
