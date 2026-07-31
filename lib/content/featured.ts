import type { EventRow } from "./queries";

/**
 * The events the public /events page leads with: the cycle's next anchor
 * events, soonest first, capped at `limit` (three — one desktop row, and few
 * enough that the agenda still starts near the fold on mobile).
 *
 * "Next" uses `end_at` where present so an anchor stays featured while it is
 * actually running rather than dropping off the page at its start time — the
 * same in-progress rule the agenda's upcoming/past split uses. `nowMs` is
 * passed in (from the server page's clock) rather than read here, so the
 * result is a pure function of its inputs and can't drift between SSR and
 * hydration.
 *
 * Input is assumed to be `getEvents()` order (start_at ascending).
 */
export function featuredEvents(
  events: EventRow[],
  nowMs: number,
  limit = 3
): EventRow[] {
  return events
    .filter(
      (e) => e.anchor && new Date(e.end_at ?? e.start_at).getTime() >= nowMs
    )
    .slice(0, limit);
}
