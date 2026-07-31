import type { EventRow } from "./queries";

/* A single event as a downloadable .ics — the detail rail's "Add to calendar"
   (mock 3A, July 2026). Same conventions as the cycle calendar in
   lib/cycles/anchor-events.ts: floating local wall time (events store and
   render start_at as written, no timezone), commas escaped per RFC 5545,
   CRLF line endings. */

/** "2026-08-15T09:00[:00]" → "20260815T090000" (floating, seconds dropped). */
function dt(s: string): string {
  const [d, t = "00:00"] = s.split("T");
  const [hh = "00", mm = "00"] = t.split(":");
  return `${d.replace(/-/g, "")}T${hh}${mm}00`;
}

const esc = (s: string) => s.replace(/,/g, "\\,");

export function eventICS(e: EventRow): string {
  return (
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//The Upskilling Labs//Events//EN\r\n" +
    "BEGIN:VEVENT\r\nUID:" +
    e.slug +
    "@theupskillinglabs\r\nDTSTART:" +
    dt(e.start_at) +
    (e.end_at ? "\r\nDTEND:" + dt(e.end_at) : "") +
    "\r\nSUMMARY:" +
    esc(e.name) +
    /* Prefer the full postal address (00095) — a calendar app can turn
       "4400 Massachusetts Ave NW…" into directions, where a venue label like
       "American University" only sometimes resolves. Virtual events put the
       join link here for the same reason: "Online" alone tells the calendar
       nothing. Both fall back to what earlier rows already had. */
    "\r\nLOCATION:" +
    esc(
      e.location_type === "virtual"
        ? (e.meeting_url ?? "Online")
        : (e.location_address ?? e.location_name ?? "")
    ) +
    "\r\nEND:VEVENT\r\nEND:VCALENDAR"
  );
}

export function eventIcsHref(e: EventRow): string {
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(eventICS(e));
}
