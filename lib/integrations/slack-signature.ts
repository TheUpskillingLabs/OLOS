import crypto from "node:crypto";

/* Verify an inbound Slack request signature — used by the slash-command and
   interactivity route handlers, which are unauthenticated public endpoints
   (/api/ is a public path in proxy.ts) and so must authenticate the request
   themselves. This is the first HMAC-verification surface in the codebase.

   Slack signs the string `v0:{timestamp}:{rawBody}` with the app's signing
   secret (HMAC-SHA256) and sends the hex digest as `X-Slack-Signature: v0=…`
   plus `X-Slack-Request-Timestamp`. We recompute it over the EXACT raw body
   (read via `request.text()` before any parsing), compare in constant time,
   and reject timestamps more than 5 minutes off to blunt replay.
   https://api.slack.com/authentication/verifying-requests-from-slack */

const FIVE_MINUTES_S = 60 * 5;

export function verifySlackSignature({
  signingSecret,
  rawBody,
  timestamp,
  signature,
  nowMs = Date.now(),
}: {
  signingSecret: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  /** Injectable clock for tests. */
  nowMs?: number;
}): boolean {
  if (!signingSecret || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(nowMs / 1000 - ts) > FIVE_MINUTES_S) return false;

  const expected =
    "v0=" +
    crypto
      .createHmac("sha256", signingSecret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // timingSafeEqual throws on length mismatch — guard first so a wrong-length
  // signature is a clean `false`, not an exception.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
