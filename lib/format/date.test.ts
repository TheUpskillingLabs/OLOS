import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

describe("formatDate", () => {
  it("formats an ISO timestamp deterministically (en-US, UTC)", () => {
    expect(formatDate("2026-07-04T12:00:00Z")).toBe("7/4/2026");
  });

  it("does not shift the date for late-UTC timestamps", () => {
    // 23:59 UTC stays on the 4th regardless of the host timezone —
    // the exact mismatch a bare toLocaleDateString() produces.
    expect(formatDate("2026-07-04T23:59:59Z")).toBe("7/4/2026");
  });

  it("handles date-only strings", () => {
    expect(formatDate("2026-01-31")).toBe("1/31/2026");
  });
});
