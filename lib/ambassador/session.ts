/* The next session an ambassador invites people to — the deck's slides 5 and
   6, the "Who will you ask?" message, and "Who's first?". In the prototype
   this was a hand-kept data/schedule.json; in OLOS it is the next published
   public event (lib/content/queries.ts), so it never goes stale. */

import { getEvents, type EventRow } from "@/lib/content/queries";

/** Serializable — handed from server pages to client islands. */
export interface AmbassadorSession {
  slug: string;
  title: string;
  /** "workshop", "kickoff", … — the event's kind, lowercased, or "event". */
  type: string;
  /** Short place label ("MLK Library"), or "online". */
  place: string;
  /** "Thursday, October 15" in the venue's zone (America/New_York today). */
  day: string;
  /** "6:00 PM" */
  time: string;
  /** "Oct 15, 2026" */
  short: string;
  /** ISO instant. */
  startsAt: string;
  /** Path to the event's public page. */
  href: string;
  /** What to expect, when the event says. */
  expect: string | null;
}

/** Events are DC-run today; a per-Lab zone comes with per-Lab events. */
const ZONE = "America/New_York";

export function toAmbassadorSession(e: EventRow): AmbassadorSession {
  const at = new Date(e.start_at);
  return {
    slug: e.slug,
    title: e.name,
    type: (e.kind ?? "event").toLowerCase(),
    place: e.location_type === "virtual" ? "online" : (e.location_name ?? "").split(",")[0] || "the library",
    day: at.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: ZONE }),
    time: at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ZONE }),
    short: at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: ZONE }),
    startsAt: at.toISOString(),
    href: `/events/${e.slug}`,
    expect: e.description,
  };
}

/** The next public event that hasn't started, or null between seasons. */
export async function nextAmbassadorSession(now = new Date()): Promise<AmbassadorSession | null> {
  const events = await getEvents();
  const next = events.find((e) => new Date(e.start_at).getTime() > now.getTime());
  return next ? toAmbassadorSession(next) : null;
}

/** The two upcoming sessions the deck's last slides list. */
export async function upcomingAmbassadorSessions(n = 2, now = new Date()): Promise<AmbassadorSession[]> {
  const events = await getEvents();
  return events
    .filter((e) => new Date(e.start_at).getTime() > now.getTime())
    .slice(0, n)
    .map(toAmbassadorSession);
}
