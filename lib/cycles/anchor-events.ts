// The cycle's six anchor events — its public rhythm and the presence
// commitment in the Open Cycle Agreement (the five core post-Kickoff events).
//
// Content ported from onboarding-proto events/data.js (the prototype's CMS).
// This constant is the interim source until the Luma events cache lands
// (backend doc §3) — production then serves these from the events table and
// this file retires. Shape kept Luma-ish so that swap stays a swap.

export interface AnchorEvent {
  api_id: string;
  slug: string;
  name: string;
  start_at: string; // local ISO, no timezone — rendered as written
  end_at: string;
  location_name: string;
  kickoff?: boolean;
}

export const ANCHOR_EVENTS: AnchorEvent[] = [
  {
    api_id: "anchor-01",
    slug: "kickoff-summit",
    name: "Kickoff Summit — Civic & Elections Cycle",
    start_at: "2026-07-14T18:00",
    end_at: "2026-07-14T21:00",
    location_name: "DC Public Library — Main branch",
    kickoff: true,
  },
  {
    api_id: "anchor-06",
    slug: "problem-sprint",
    name: "Problem Sprint",
    // Sat Jul 25 — problem statements 9am–12pm, voting 12–1pm, pod forming
    // opens 1pm (docs/requirements/cycle-timeline.md, Cycle 3 schedule)
    start_at: "2026-07-25T09:00",
    end_at: "2026-07-25T13:00",
    location_name: "Main branch",
  },
  {
    api_id: "anchor-02",
    slug: "meet-the-pods",
    name: "Meet the Pods",
    start_at: "2026-08-11T18:00",
    end_at: "2026-08-11T20:30",
    location_name: "Main branch",
  },
  {
    api_id: "anchor-03",
    slug: "hackathon-frame-sprint",
    name: "Hackathon — the Frame Sprint",
    start_at: "2026-08-13T09:00",
    end_at: "2026-08-13T18:00",
    location_name: "Main branch",
  },
  {
    api_id: "anchor-04",
    slug: "meet-the-projects",
    name: "Meet the Projects",
    start_at: "2026-09-08T18:00",
    end_at: "2026-09-08T20:30",
    location_name: "Main branch",
  },
  {
    api_id: "anchor-05",
    slug: "showcase-summit",
    name: "Showcase Summit",
    start_at: "2026-10-13T18:00",
    end_at: "2026-10-13T21:00",
    location_name: "DC Public Library — Main branch",
  },
];

/** The five core post-Kickoff events — the presence commitment. */
export function coreEvents(): AnchorEvent[] {
  return ANCHOR_EVENTS.filter((e) => !e.kickoff);
}

/** "Jul 28 · 6 PM" — the prototype's fmtEvt. */
export function fmtEvt(e: AnchorEvent): string {
  const d = new Date(e.start_at);
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${mo} ${d.getDate()} · ${h} ${ap}`;
}

/** The anchor events as a downloadable .ics (the prototype's cycleICS). */
export function cycleICS(): string {
  const dt = (s: string) => s.replace(/[-:]/g, "") + "00";
  return (
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//The Upskilling Labs//Open Cycle//EN\r\n" +
    ANCHOR_EVENTS.map(
      (e) =>
        "BEGIN:VEVENT\r\nUID:" +
        e.api_id +
        "@theupskillinglabs\r\nDTSTART:" +
        dt(e.start_at) +
        "\r\nSUMMARY:" +
        e.name.replace(/,/g, "\\,") +
        "\r\nLOCATION:" +
        (e.location_name || "").replace(/,/g, "\\,") +
        "\r\nEND:VEVENT"
    ).join("\r\n") +
    "\r\nEND:VCALENDAR"
  );
}

export function icsHref(): string {
  return "data:text/calendar;charset=utf-8," + encodeURIComponent(cycleICS());
}
