import { describe, it, expect } from "vitest";
import {
  DEFAULT_EXPIRY_DAYS,
  announcementPhase,
  defaultExpiry,
  fromLocalInput,
  scheduleError,
  toLocalInput,
} from "./schedule";

const NOW = new Date("2026-10-09T12:00:00Z");
const past = "2026-10-01T00:00:00Z";
const future = "2026-10-20T00:00:00Z";

describe("defaultExpiry", () => {
  it("is two weeks after the given creation time", () => {
    expect(DEFAULT_EXPIRY_DAYS).toBe(14);
    expect(defaultExpiry(NOW).toISOString()).toBe("2026-10-23T12:00:00.000Z");
  });
});

describe("announcementPhase", () => {
  const row = (
    status: "draft" | "published" | "archived",
    published_at: string | null,
    expires_at: string | null
  ) => ({ status, published_at, expires_at });

  it("passes draft and archived through regardless of dates", () => {
    expect(announcementPhase(row("draft", future, past), NOW)).toBe("draft");
    expect(announcementPhase(row("archived", past, future), NOW)).toBe("archived");
  });

  it("is scheduled while go-live is in the future", () => {
    expect(announcementPhase(row("published", future, null), NOW)).toBe("scheduled");
  });

  it("is live between go-live and expiry, or with no expiry", () => {
    expect(announcementPhase(row("published", past, future), NOW)).toBe("live");
    expect(announcementPhase(row("published", past, null), NOW)).toBe("live");
    expect(announcementPhase(row("published", null, null), NOW)).toBe("live");
  });

  it("is expired once expires_at has passed (even before the sweep)", () => {
    expect(announcementPhase(row("published", past, past), NOW)).toBe("expired");
    expect(
      announcementPhase(row("published", past, NOW.toISOString()), NOW)
    ).toBe("expired");
  });
});

describe("scheduleError", () => {
  it("allows no expiry", () => {
    expect(
      scheduleError({ publishing: true, goLive: null, expiresAt: null, now: NOW })
    ).toBeNull();
  });

  it("rejects an expiry at or before go-live", () => {
    expect(
      scheduleError({ publishing: true, goLive: future, expiresAt: future, now: NOW })
    ).toMatch(/after the go-live/);
  });

  it("rejects publishing with an expiry already in the past", () => {
    expect(
      scheduleError({ publishing: true, goLive: null, expiresAt: past, now: NOW })
    ).toMatch(/after the go-live|in the past/);
  });

  it("allows a draft with a stale expiry (fixed before publishing)", () => {
    expect(
      scheduleError({
        publishing: false,
        goLive: "2026-09-01T00:00:00Z",
        expiresAt: past,
        now: NOW,
      })
    ).toBeNull();
  });

  it("accepts a scheduled window in the future", () => {
    expect(
      scheduleError({
        publishing: true,
        goLive: future,
        expiresAt: "2026-11-03T00:00:00Z",
        now: NOW,
      })
    ).toBeNull();
  });
});

describe("datetime-local round trip", () => {
  it("returns empty / null for empty values", () => {
    expect(toLocalInput(null)).toBe("");
    expect(fromLocalInput("")).toBeNull();
  });

  it("round-trips to the minute in local time", () => {
    const iso = "2026-10-20T15:30:00.000Z";
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });
});
