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

// Names, times and venue for kickoff / meet-the-pods / showcase are the LIVE
// LUMA EVENTS' facts (owner decision 2026-07-30: Luma is the source of truth
// for public event facts; the events table rows were merged with their Luma
// twins the same day — scripts/ops/anchor-luma-merge-2026-07-30.sql). If a
// time looks odd, fix it on Luma first; this constant follows.
export const ANCHOR_EVENTS: AnchorEvent[] = [
  {
    api_id: "anchor-01",
    slug: "kickoff-summit",
    name: "Upskilling Summit #2: Energy/Climate Cycle Project Showcase & Civics/Elections Cycle Kick-Off",
    start_at: "2026-07-14T16:30",
    end_at: "2026-07-14T20:30",
    location_name: "Martin Luther King Jr. Memorial Library, Washington, DC",
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
    name: "Meet the Pods: Civics and Elections",
    start_at: "2026-08-11T16:30",
    end_at: "2026-08-11T19:15",
    location_name: "Martin Luther King Jr. Memorial Library, Washington, DC",
  },
  {
    api_id: "anchor-03",
    slug: "civics-elections-hackathon",
    // Re-cast as the public, AU co-hosted event (migration 00092). Saturday,
    // not the mid-week Frame Sprint date this entry used to carry.
    name: "Idea to Prototype: A Civics and Elections Hackathon",
    start_at: "2026-08-15T09:00",
    end_at: "2026-08-15T16:30",
    location_name: "American University, Constitution Hall",
  },
  {
    api_id: "anchor-04",
    slug: "meet-the-projects",
    name: "Meet the Projects: Civics & Elections",
    start_at: "2026-09-08T16:45",
    // End per the recurring MLK evening slot (16:45–19:30, as the prior
    // cycles' Meet the X events ran); confirm against the Luma row.
    end_at: "2026-09-08T19:30",
    location_name: "Martin Luther King Jr. Memorial Library, Washington, DC",
  },
  {
    api_id: "anchor-05",
    slug: "showcase-summit",
    name: "Upskilling Summit #3: Showcase Civics and Elections and Kick-off Q4 build cycle (Theme: TBD)",
    start_at: "2026-10-13T16:30",
    end_at: "2026-10-13T20:30",
    location_name: "Martin Luther King Jr. Memorial Library, Washington, DC",
  },
];

/** The five core post-Kickoff events — the presence commitment. */
export function coreEvents(): AnchorEvent[] {
  return ANCHOR_EVENTS.filter((e) => !e.kickoff);
}

/** "Jul 28 · 6 PM" / "Aug 11 · 4:30 PM" — the prototype's fmtEvt, plus
    minutes when they're non-zero: the real anchor times are half-past starts
    now, and "4 PM" for a 4:30 event is the show-up-at-the-wrong-time bug in
    miniature. */
export function fmtEvt(e: AnchorEvent): string {
  const d = new Date(e.start_at);
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()];
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${mo} ${d.getDate()} · ${h}${m ? ":" + String(m).padStart(2, "0") : ""} ${ap}`;
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
