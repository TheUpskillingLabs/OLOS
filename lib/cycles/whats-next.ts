/* "What's next" — the one message every surface shows while no public Build
 * Cycle is recruiting (decided 2026-10-06 with the board advisor and AMG;
 * epic #477, decisions #480, ops log #481; docs/requirements/cycle-4-readiness.md).
 *
 *   1. This quarter the Labs turn their method on themselves: an internal
 *      Build Cycle (an org cycle), named publicly as an invitation to people
 *      who have taken part before. Joining is through Slack.
 *   2. Public workshops and meetups keep running.
 *   3. The first public Build Cycle of 2027 kicks off January 12 — join the
 *      waitlist (role_intents ∋ 'cycle').
 *
 * Cycle facts are data: the internal cycle's dates come from its org cycle
 * row, and an `upcoming` open HQ cycle's start_date replaces the kickoff
 * constant (lib/cycles/whats-next-data.ts reads both). The constant is the
 * only interim fact; once its date passes the copy falls back to "is being
 * planned", so a forgotten constant never becomes a stale promise.
 *
 * Pure (no Supabase), so it is safe in client components and email
 * templates. Replaces lib/cycles/next-public-cycle.ts. */

import { SLACK_INVITE_FALLBACK } from "@/lib/tasks/definitions";

/** The first public Build Cycle of 2027 (DATE, UTC). Interim until the
 *  2027 cycle row exists; that row's start_date wins. */
export const NEXT_PUBLIC_CYCLE_KICKOFF = "2027-01-12";

export interface InternalCycleFacts {
  name: string;
  start_date: string | null;
  end_date: string | null;
}

export interface WhatsNextFacts {
  /** The HQ org cycle that is upcoming or active, if any. */
  internalCycle: InternalCycleFacts | null;
  /** start_date of the upcoming open HQ cycle, if one exists. */
  upcomingPublicStart: string | null;
}

export const NO_WHATS_NEXT_FACTS: WhatsNextFacts = {
  internalCycle: null,
  upcomingPublicStart: null,
};

export interface WhatsNextMessage {
  chip: string;
  heading: string;
  /** The internal-cycle invitation (with its dates when the row has them),
   *  or null when there is no internal cycle to invite anyone into. */
  internal: string | null;
  notChanging: string;
  /** The next public cycle line: a date, or "is being planned". */
  nextPublic: string;
  /** The kickoff DATE (YYYY-MM-DD) this message is built on, or null. */
  kickoff: string | null;
  /** "Jan 12, 2027", or null. */
  kickoffShort: string | null;
  /** "January 12" (the interim date, whose year the copy already names) or
   *  "February 2, 2027" (a cycle row's date); null when none. For "Get ready
   *  for …". */
  kickoffLabel: string | null;
  /** "Oct 13 – Dec 8", or null without the org cycle row. */
  internalDates: string | null;
  waitlistCta: string;
  /** "2027 waitlist" — a badge. */
  waitlistLabel: string;
  onWaitlist: string;
  /** The promise made to someone on the waitlist (dashboard + email). */
  waitlistPromise: string;
  internalCta: string;
  eventsCta: string;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmt(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(d);
}

/** "Oct 13 – Dec 8" (the year only when the range crosses one). */
export function fmtDateRange(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return null;
  const cross = s.getUTCFullYear() !== e.getUTCFullYear();
  const opts: Intl.DateTimeFormatOptions = cross
    ? { month: "short", day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric" };
  return `${fmt(s, opts)} – ${fmt(e, opts)}`;
}

/** The date the next public cycle kicks off: the upcoming row's start_date
 *  when there is one, else the constant while it is still ahead, else null. */
export function nextPublicKickoff(
  upcomingPublicStart: string | null | undefined,
  now: Date = new Date(),
  fallback: string = NEXT_PUBLIC_CYCLE_KICKOFF
): string | null {
  if (parseDate(upcomingPublicStart)) return upcomingPublicStart!.slice(0, 10);
  const f = parseDate(fallback);
  if (!f) return null;
  // Still ahead through the kickoff day itself.
  return now.getTime() < f.getTime() + 24 * 60 * 60 * 1000 ? fallback : null;
}

/** Where people who have taken part before say they're in: the Slack
 *  thread permalink when set, else the workspace invite. */
export function internalCycleJoinUrl(): string {
  return (
    process.env.NEXT_PUBLIC_INTERNAL_CYCLE_JOIN_URL ||
    process.env.NEXT_PUBLIC_SLACK_INVITE_URL ||
    SLACK_INVITE_FALLBACK
  );
}

export function whatsNextMessage(
  facts: WhatsNextFacts = NO_WHATS_NEXT_FACTS,
  now: Date = new Date()
): WhatsNextMessage {
  const kickoff = nextPublicKickoff(facts.upcomingPublicStart, now);
  const k = parseDate(kickoff);
  const year = k ? k.getUTCFullYear() : null;
  const monthDay = k ? fmt(k, { month: "long", day: "numeric" }) : null;
  const fromRow = !!parseDate(facts.upcomingPublicStart);

  const internalDates = facts.internalCycle
    ? fmtDateRange(facts.internalCycle.start_date, facts.internalCycle.end_date)
    : null;
  // The invitation shows while the internal cycle's row exists, or — before
  // ops creates it — during the interim the kickoff constant covers. After
  // that, with no row, the message is plain "between cycles".
  const showInternal = !!facts.internalCycle || (!!k && !fromRow);
  const when = internalDates
    ? `From ${internalDates.replace(" – ", " to ")} we're running`
    : "This quarter we're running";

  const nextPublic = !k
    ? "The next public Build Cycle is being planned."
    : fromRow
      ? `The next public Build Cycle kicks off ${monthDay}, ${year}.`
      : `The first public Build Cycle of ${year} kicks off ${monthDay}.`;

  const waitlist = year ? `the ${year} waitlist` : "the waitlist";
  const which = !k
    ? "the next public Build Cycle"
    : fromRow
      ? `the next public Build Cycle, which kicks off ${monthDay}, ${year}`
      : `the first public Build Cycle of ${year}, which kicks off ${monthDay}`;

  return {
    chip: showInternal ? "A new kind of Build Cycle" : "Between cycles",
    heading: showInternal
      ? "This quarter, we're turning our method on ourselves"
      : "No public Build Cycle is open right now",
    internal: showInternal
      ? `${when} an internal Build Cycle to strengthen the Labs' foundation, so we can help even more people${year ? ` in ${year}` : ""}. Taken part in the Labs before? You're invited.`
      : null,
    notChanging:
      "Our public workshops and meetups keep running, in person and online. Come learn, and bring a friend.",
    nextPublic,
    kickoff,
    kickoffShort: k ? fmt(k, { month: "short", day: "numeric", year: "numeric" }) : null,
    kickoffLabel: !k ? null : fromRow ? `${monthDay}, ${year}` : monthDay,
    internalDates,
    waitlistCta: `Join ${waitlist}`,
    waitlistLabel: year ? `${year} waitlist` : "Waitlist",
    onWaitlist: `You're on ${waitlist}`,
    waitlistPromise: `You're on the waitlist for ${which}. We'll tell you on your dashboard, and by email, the day pre-registration opens.`,
    internalCta: "Taken part before? Join the internal cycle",
    eventsCta: "See workshops and events",
  };
}
