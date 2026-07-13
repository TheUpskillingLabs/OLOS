import { describe, expect, it } from "vitest";
import {
  parseWindow,
  windowOpen,
  toLabInput,
  fromLabInput,
  fmtLabDateTime,
  fmtLabDate,
} from "./lab-time";

/* Cycle 3 runs Jul 14 – Oct 13, 2026 (EDT, UTC-4). US DST 2026:
   spring forward Mar 8, fall back Nov 1. */

describe("parseWindow", () => {
  it("parses a naive stored value as UTC (space or T separator)", () => {
    expect(parseWindow("2026-07-25 13:00:00")?.toISOString()).toBe(
      "2026-07-25T13:00:00.000Z"
    );
    expect(parseWindow("2026-07-25T13:00:00")?.toISOString()).toBe(
      "2026-07-25T13:00:00.000Z"
    );
  });
  it("respects an explicit zone when present", () => {
    expect(parseWindow("2026-07-25T13:00:00Z")?.toISOString()).toBe(
      "2026-07-25T13:00:00.000Z"
    );
    expect(parseWindow("2026-07-25T09:00:00-04:00")?.toISOString()).toBe(
      "2026-07-25T13:00:00.000Z"
    );
  });
  it("handles null/empty/garbage", () => {
    expect(parseWindow(null)).toBeNull();
    expect(parseWindow("")).toBeNull();
    expect(parseWindow("not a date")).toBeNull();
  });
});

describe("windowOpen", () => {
  const open = "2026-07-25T13:00:00"; // 9 AM EDT
  const close = "2026-07-25T16:00:00"; // noon EDT
  it("is open inside the window and closed outside", () => {
    expect(windowOpen(open, close, new Date("2026-07-25T14:00:00Z"))).toBe(true);
    expect(windowOpen(open, close, new Date("2026-07-25T12:59:00Z"))).toBe(false);
    expect(windowOpen(open, close, new Date("2026-07-25T16:01:00Z"))).toBe(false);
  });
  it("bounds are inclusive", () => {
    expect(windowOpen(open, close, new Date("2026-07-25T13:00:00Z"))).toBe(true);
    expect(windowOpen(open, close, new Date("2026-07-25T16:00:00Z"))).toBe(true);
  });
  it("missing bounds mean closed", () => {
    expect(windowOpen(null, close)).toBe(false);
    expect(windowOpen(open, null)).toBe(false);
  });
});

describe("fromLabInput (lab wall-clock → naive UTC)", () => {
  it("EDT: 9:00 AM ET Jul 25 stores as 13:00 UTC", () => {
    expect(fromLabInput("2026-07-25T09:00")).toBe("2026-07-25T13:00:00");
  });
  it("EST: 9:00 AM ET Dec 1 stores as 14:00 UTC", () => {
    expect(fromLabInput("2026-12-01T09:00")).toBe("2026-12-01T14:00:00");
  });
  it("crosses the date line when late-evening ET lands next-day UTC", () => {
    expect(fromLabInput("2026-07-28T23:59")).toBe("2026-07-29T03:59:00");
  });
  it("day after fall-back (Nov 2) uses EST, not a stale +4", () => {
    expect(fromLabInput("2026-11-02T09:00")).toBe("2026-11-02T14:00:00");
  });
  it("rejects malformed input", () => {
    expect(fromLabInput("")).toBeNull();
    expect(fromLabInput("2026-07-25")).toBeNull();
  });
});

describe("toLabInput (stored naive UTC → lab wall-clock input value)", () => {
  it("EDT round-trip", () => {
    expect(toLabInput("2026-07-25T13:00:00")).toBe("2026-07-25T09:00");
  });
  it("EST round-trip", () => {
    expect(toLabInput("2026-12-01T14:00:00")).toBe("2026-12-01T09:00");
  });
  it("empty for null", () => {
    expect(toLabInput(null)).toBe("");
  });
});

describe("round-trip stability", () => {
  const inputs = [
    "2026-07-14T18:00", // Kickoff (EDT)
    "2026-07-28T23:59", // forming close, crosses UTC midnight
    "2026-10-13T21:00", // Summit end (EDT)
    "2026-11-02T09:00", // post-fall-back (EST)
    "2026-03-09T09:00", // post-spring-forward (EDT)
  ];
  for (const v of inputs) {
    it(`toLabInput(fromLabInput(${v})) === ${v}`, () => {
      expect(toLabInput(fromLabInput(v)!)).toBe(v);
    });
  }
});

describe("display formatting", () => {
  it("renders the lab wall-clock with the ET label", () => {
    expect(fmtLabDateTime("2026-07-25T13:00:00")).toBe("Jul 25, 9:00 AM ET");
  });
  it("renders EST values correctly too", () => {
    expect(fmtLabDateTime("2026-12-01T14:00:00")).toBe("Dec 1, 9:00 AM ET");
  });
  it("date-only helper renders the lab-local date", () => {
    // 03:59 UTC on Jul 29 is still Jul 28 in the lab.
    expect(fmtLabDate("2026-07-29T03:59:00")).toBe("Jul 28");
  });
});
