import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

/* Shared primitives for per-IP throttling of public (unauthenticated) write
   endpoints — the backend doc §8 pre-launch blocker. The pattern: store
   sha256(ip) on the row, count rows from that hash inside the window before
   inserting. First consumer is the event RSVP; the survey and waitlist
   public writes reuse it as they land.

   The hash is deliberately unsalted: it exists to group requests from one
   address, not to hide the address from ourselves — and a per-deploy salt
   would break counting across restarts. Raw IPs are never stored. */

/** sha256 hex of the caller's address — the stored grouping key. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

/** Best-effort client IP behind Vercel's proxy chain. */
export function requestIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** ISO timestamp for the start of a lookback window ending now. */
export function windowStart(windowMs: number, now: Date = new Date()): string {
  return new Date(now.getTime() - windowMs).toISOString();
}
