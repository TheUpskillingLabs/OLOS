import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifySlackSignature } from "./slack-signature";

const secret = "8f742231b10e8888abcd99yyyzzz85a5";

function sign(body: string, ts: string, withSecret = secret): string {
  return (
    "v0=" +
    crypto.createHmac("sha256", withSecret).update(`v0:${ts}:${body}`).digest("hex")
  );
}

describe("verifySlackSignature", () => {
  const body = "token=xyz&team_id=T1&command=%2Flearninglog&user_id=U1";
  const nowMs = 1_700_000_000_000;
  const ts = String(Math.floor(nowMs / 1000));

  it("accepts a correctly signed, fresh request", () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        rawBody: body,
        timestamp: ts,
        signature: sign(body, ts),
        nowMs,
      })
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        rawBody: body + "&injected=1",
        timestamp: ts,
        signature: sign(body, ts),
        nowMs,
      })
    ).toBe(false);
  });

  it("rejects a stale timestamp (> 5 min old)", () => {
    const oldTs = String(Math.floor(nowMs / 1000) - 6 * 60);
    expect(
      verifySlackSignature({
        signingSecret: secret,
        rawBody: body,
        timestamp: oldTs,
        signature: sign(body, oldTs),
        nowMs,
      })
    ).toBe(false);
  });

  it("rejects a future-dated timestamp (> 5 min ahead)", () => {
    const futureTs = String(Math.floor(nowMs / 1000) + 6 * 60);
    expect(
      verifySlackSignature({
        signingSecret: secret,
        rawBody: body,
        timestamp: futureTs,
        signature: sign(body, futureTs),
        nowMs,
      })
    ).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        rawBody: body,
        timestamp: ts,
        signature: sign(body, ts, "wrong-secret"),
        nowMs,
      })
    ).toBe(false);
  });

  it("rejects when headers are missing", () => {
    expect(
      verifySlackSignature({
        signingSecret: secret,
        rawBody: body,
        timestamp: null,
        signature: null,
        nowMs,
      })
    ).toBe(false);
  });

  it("rejects when the signing secret is empty", () => {
    expect(
      verifySlackSignature({
        signingSecret: "",
        rawBody: body,
        timestamp: ts,
        signature: sign(body, ts),
        nowMs,
      })
    ).toBe(false);
  });
});
