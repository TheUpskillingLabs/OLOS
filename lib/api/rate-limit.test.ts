import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { hashIp, requestIp, windowStart } from "./rate-limit";

function fakeRequest(headers: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe("hashIp", () => {
  it("is a deterministic sha256 hex digest", () => {
    expect(hashIp("203.0.113.9")).toBe(hashIp("203.0.113.9"));
    expect(hashIp("203.0.113.9")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.9")).not.toBe(hashIp("203.0.113.10"));
  });
});

describe("requestIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    const req = fakeRequest({
      "x-forwarded-for": "203.0.113.9, 10.0.0.1",
    });
    expect(requestIp(req)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(requestIp(fakeRequest({ "x-real-ip": "203.0.113.9" }))).toBe(
      "203.0.113.9"
    );
    expect(requestIp(fakeRequest({}))).toBe("unknown");
  });
});

describe("windowStart", () => {
  it("subtracts the window from the reference time", () => {
    const now = new Date("2026-07-04T12:00:00.000Z");
    expect(windowStart(60 * 60 * 1000, now)).toBe("2026-07-04T11:00:00.000Z");
  });
});
