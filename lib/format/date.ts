/**
 * Hydration-safe date formatting for client components.
 *
 * A bare `new Date(iso).toLocaleDateString()` renders differently on the
 * server (container locale/timezone) and in the browser (user's), so any
 * SSR'd client component using it can hydration-mismatch. Pinning both the
 * locale and the timezone makes the output deterministic everywhere.
 *
 * Trade-off: dates render in UTC, so a viewer far from UTC can see a
 * timestamp shift by a calendar day. Acceptable for the admin metadata
 * these appear in (invited/expires/joined dates).
 */

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}
