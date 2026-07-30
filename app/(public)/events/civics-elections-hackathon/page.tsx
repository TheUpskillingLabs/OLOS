import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  EditorialHeader,
  EdSection,
  EdRow,
} from "@/app/components/chrome/editorial";
import { EventTeaser } from "@/app/components/content/teasers";
import { MemberRegister } from "../[slug]/rsvp";
import { fmtDay, fmtTime } from "@/lib/content/format";
import { getEvent, getEvents } from "@/lib/content/queries";
import { publicSession } from "@/lib/auth/public-session";
import { createServiceClient } from "@/lib/supabase/server";

/* /events/civics-elections-hackathon — the landing page for the Aug 15 event
   co-hosted with American University.

   A static route deliberately shadowing /events/[slug]: this one event carries
   two tracks, an eleven-row two-column schedule, named facilitators and a
   sponsor wall, none of which the generic detail page's kv-rows-plus-body
   shape can hold. Everything else about the event still lives in the `events`
   row (migration 00092) so the card, the featured strip and the related list
   stay in sync — the copy below is the only thing this file owns.

   Built on the editorial "standards-manual" grid (EdSection / EdRow / .ed-doc),
   the same one /build-cycles uses, not the .section + .section-head browse
   vocabulary: app/page.tsx states the split — the heavy-ruled section head is
   for browse sections whose content runs full-width, the column grid is for
   content pages, and this is a content page. Content sits in editorial columns
   rather than card boxes for the same reason.

   Registration is the same rule as /events/[slug] — members one-tap with their
   account, everyone else goes to Luma where its questions and photo release
   live. A bare external link would have meant no event_rsvps rows at all for
   the cycle's biggest public event, and no "You're going" state for members. */

const REGISTER_URL = "https://luma.com/bgow5pki";
const SLUG = "civics-elections-hackathon";

export const dynamic = "force-dynamic";

export const metadata = {
  title:
    "Idea to Prototype: A Civics and Elections Hackathon · The Upskilling Labs",
  description:
    "A free, one-day event on Saturday, August 15 at American University. Go from idea to working prototype with real teammates, real tools, and a real plan to test what you build.",
  openGraph: {
    title: "Idea to Prototype: A Civics and Elections Hackathon",
    description:
      "Saturday, August 15, 9:00 AM to 4:30 PM at American University. Free, non-partisan, no AI experience required.",
    type: "article",
  },
};

/* `.ed-cols` reads its column count from --ed-n; EdRow only exposes 2 and 4,
   so a three-column row sets the variable directly rather than inventing a
   fourth class. */
const THREE_COLS = { "--ed-n": 3 } as CSSProperties;

/* ── Content ────────────────────────────────────────────────────────────── */

const AUDIENCE = [
  {
    lbl: "Curious about AI",
    h: "No experience required",
    p: "You haven’t gotten hands-on with AI tools yet, and that’s fine. This is a beginner-friendly way to start.",
  },
  {
    lbl: "Care about civics",
    h: "Do something, not just read",
    p: "You care about civic engagement and want to do something beyond reading about it.",
  },
  {
    lbl: "Want community",
    h: "Meet people making things",
    p: "You want to meet builders, organizers, and researchers who are working to change the status quo.",
  },
];

const TRACKS = [
  {
    label: "Track one",
    h: "Newcomer track",
    sub: "Get hands-on with AI, start to finish",
    p: "Join a beginner-friendly morning track where you’ll learn how to turn an idea into something you can actually show someone. In the afternoon, you’ll get a look inside what the Pods are building.",
    points: [
      "See a real project up close and ask every question you’ve been holding",
      "Learn by doing. You’ll leave with something you actually built",
      "No prior experience needed; your outside perspective is genuinely useful here",
    ],
  },
  {
    label: "Track two",
    h: "Pod sprint track",
    sub: "For Upskillers in the Civics & Elections Build Cycle",
    p: "Join a Pod, a small research team focused on a specific civics or elections challenge, for a structured, full-day problem-solving sprint.",
    points: [
      "Share your perspective on the problem with your Pod",
      "Help identify promising directions, then choose one to explore",
      "Build a simple prototype and a plan to test it with a real user",
    ],
  },
];

/** A schedule row. `both` collapses the two tracks into one shared cell. */
type Slot = {
  time: string;
  both?: React.ReactNode;
  pod?: React.ReactNode;
  newcomer?: React.ReactNode;
};

// Facilitator links, kept beside the schedule they appear in.
const A = ({ href, children }: { href: string; children: string }) => (
  <a className="see" href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const SCHEDULE: Slot[] = [
  { time: "9:00 AM", both: "Light breakfast" },
  { time: "9:30 AM", both: "Welcome from American University hosts" },
  {
    time: "9:45 AM",
    pod: (
      <>
        Frame and orient problem statements with{" "}
        <A href="https://www.linkedin.com/in/ilianaestevez/">Iliana Estévez</A>
      </>
    ),
    newcomer: "About The Upskilling Labs and what to expect",
  },
  {
    time: "10:00 AM",
    pod: "Lightning talks, “How Might We” statements",
    newcomer: (
      <>
        Workshop: design thinking with{" "}
        <A href="https://www.linkedin.com/in/emily-modde/">Emily Modde</A>
      </>
    ),
  },
  {
    time: "10:50 AM",
    pod: "Build prototypes",
    newcomer: "Workshop: tool set-up and wayfinding",
  },
  { time: "11:20 AM", pod: "Build prototypes", newcomer: "Pod briefing" },
  { time: "11:50 AM", both: "Lunch" },
  {
    time: "1:00 PM",
    pod: "Build prototypes",
    newcomer: (
      <>
        Workshop: From Prompt to Prototype, building your professional website
        with <A href="https://www.linkedin.com/in/ajbubb/">AJ Bubb</A> and
        Lovable.dev
      </>
    ),
  },
  {
    time: "2:30 PM",
    pod: "Build prototypes",
    newcomer: (
      <>
        Workshop: Working Backwards from the Outcome, a prompting workshop with{" "}
        <A href="https://www.linkedin.com/in/ashwin-jaiprakash-67366b24/">
          Ashwin Jaiprakash
        </A>
      </>
    ),
  },
  { time: "3:30 PM", both: "Pod member prototype presentations" },
  { time: "4:30 PM", both: "Depart for happy hour" },
];

const STATS = [
  { n: "12", l: "Weeks per Build Cycle" },
  { n: "1", l: "Day, idea to prototype" },
  { n: "2", l: "Tracks, newcomer and Pod sprint" },
  { n: "0", l: "Credentials required" },
];

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function HeroMeta({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="t-body" style={{ color: "var(--od1)", fontWeight: 600 }}>
        {v}
      </div>
      <div className="lbl" style={{ color: "var(--od3)", marginTop: 2 }}>
        {k}
      </div>
    </div>
  );
}

function ScheduleRow({ slot }: { slot: Slot }) {
  const cell = "t-body px-4 py-3 align-top";
  return (
    <tr style={{ borderTop: "1px solid var(--rule)" }}>
      <th
        scope="row"
        className="lbl whitespace-nowrap px-4 py-3 text-left align-top"
      >
        {slot.time}
      </th>
      {slot.both ? (
        <td className={cell} colSpan={2} style={{ background: "var(--tint)" }}>
          {slot.both}
        </td>
      ) : (
        <>
          <td className={cell}>{slot.pod}</td>
          <td className={cell}>{slot.newcomer}</td>
        </>
      )}
    </tr>
  );
}

/** The same rows, stacked, for narrow screens where three columns can't breathe. */
function ScheduleCard({ slot }: { slot: Slot }) {
  return (
    <div style={{ borderTop: "1px solid var(--rule)", padding: "16px 0" }}>
      <div className="lbl lbl-teal">{slot.time}</div>
      {slot.both ? (
        <p className="t-body" style={{ marginTop: 6 }}>
          {slot.both}
        </p>
      ) : (
        <>
          <p className="lbl" style={{ marginTop: 10 }}>
            Pod sprint
          </p>
          <p className="t-body">{slot.pod}</p>
          <p className="lbl" style={{ marginTop: 10 }}>
            Newcomer
          </p>
          <p className="t-body">{slot.newcomer}</p>
        </>
      )}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default async function CivicsElectionsHackathonPage() {
  // The row still owns the facts (date, venue, cost, host) so this page and
  // the /events card can never disagree; the copy above is page-only.
  const [event, events, session] = await Promise.all([
    getEvent(SLUG),
    getEvents(),
    publicSession(),
  ]);

  // Mirrors /events/[slug]: "going" reflects both in-app RSVPs and, via the
  // guest mirror, registrations made directly on Luma.
  let going = false;
  if (event && session.signedIn && session.email) {
    const supabase = createServiceClient();
    const { data: rsvp } = await supabase
      .from("event_rsvps")
      .select("id")
      .eq("event_id", event.id)
      .eq("email", session.email)
      .maybeSingle();
    going = Boolean(rsvp);
  }

  // Recirculation mirrors /events/[slug]: the next three sessions at or after
  // this one, falling back to the last three when this is the final event.
  // Anchored to the event's own date rather than the clock, so it stays pure.
  const after = event
    ? events.filter(
        (x) =>
          x.slug !== SLUG && new Date(x.start_at) >= new Date(event.start_at)
      )
    : [];
  const related = after.length
    ? after.slice(0, 3)
    : events.filter((x) => x.slug !== SLUG).slice(-3);

  // Facts come from the row so this page and the /events card can never
  // disagree; the literals are only a fallback for the (impossible in
  // practice, but typed) case where the row is missing or unpublished.
  const when = event ? fmtDay(event.start_at) : "Saturday, Aug 15";
  const timeRange = event
    ? `${fmtTime(event.start_at)}${event.end_at ? ` – ${fmtTime(event.end_at)}` : ""}`
    : "9 AM – 4:30 PM";
  const venue =
    event?.location_name ??
    "American University, Constitution Hall, Washington, DC 20016";

  const registerBtn = (className: string) =>
    event && session.signedIn ? (
      <MemberRegister eventId={event.id} going={going} className={className} />
    ) : (
      <a
        className={className}
        href={event?.luma_url ?? REGISTER_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Register for the hackathon
      </a>
    );

  return (
    <>
      <EditorialHeader
        eyebrow="Civics & Elections · August 15"
        title="Idea to Prototype: A Civics & Elections Hackathon"
        standfirst="A free, one-day event where you go from idea to working prototype, with real teammates, real tools, and a real plan to test what you build."
      >
        <div className="ed-cols">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "24px 40px",
            }}
          >
            <HeroMeta k="Date" v={when} />
            <HeroMeta k="Time" v={timeRange} />
            <HeroMeta k="Venue" v={venue} />
            <HeroMeta k="Cost" v={event?.cost || "Free"} />
            <HeroMeta
              k="Hosted by"
              v={event?.host || "American University & The Upskilling Labs"}
            />
          </div>
        </div>
        <div className="ed-cols">{registerBtn("btn btn-teal")}</div>
      </EditorialHeader>

      {/* ── Body: the editorial document ── */}
      <div className="container" style={{ paddingTop: 88, paddingBottom: 56 }}>
        <div className="ed-doc">
          <EdSection
            eyebrow="Why this event"
            heading="Come with an open and curious mind."
          >
            <div className="ed-cols">
              <p className="t-lede ed-text">
                The event builds on civics and elections challenges inspired by
                The Upskilling Labs&rsquo; Build Cycle, a thematic twelve-week
                program where participants work on real-world problems and build
                practical solutions. No previous involvement or AI experience
                needed.
              </p>
            </div>
            <div className="ed-cols" style={THREE_COLS}>
              {AUDIENCE.map((a) => (
                <div key={a.lbl}>
                  <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                    {a.lbl}
                  </div>
                  <div className="t-h4" style={{ marginBottom: 6 }}>
                    {a.h}
                  </div>
                  <p className="t-body ed-text" style={{ color: "var(--slate)" }}>
                    {a.p}
                  </p>
                </div>
              ))}
            </div>
            <div className="ed-cols">
              <p className="t-small">
                This is a non-partisan, non-political event.
              </p>
            </div>
          </EdSection>

          <EdSection
            eyebrow="Choose your track"
            heading="Two tracks, one shared afternoon."
          >
            <EdRow cols={2}>
              {TRACKS.map((t) => (
                <div key={t.h}>
                  <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                    {t.label}
                  </div>
                  <div className="t-h3" style={{ marginBottom: 2 }}>
                    {t.h}
                  </div>
                  <p className="t-small" style={{ marginBottom: 14 }}>
                    {t.sub}
                  </p>
                  <p
                    className="t-body ed-text"
                    style={{ color: "var(--slate)", marginBottom: 14 }}
                  >
                    {t.p}
                  </p>
                  <ul
                    className="t-body ed-text"
                    style={{ color: "var(--slate)", paddingLeft: 20 }}
                  >
                    {t.points.map((pt) => (
                      <li key={pt} style={{ marginBottom: 8 }}>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </EdRow>
          </EdSection>

          <EdSection eyebrow="Schedule" heading="The day, hour by hour.">
            <div className="ed-cols">
              <div>
                <div className="hidden md:block">
                  <table className="w-full border-collapse">
                    <caption className="sr-only">
                      Schedule for Saturday, August 15, by track
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="lbl px-4 pb-3 text-left">
                          Time
                        </th>
                        <th
                          scope="col"
                          className="lbl lbl-teal px-4 pb-3 text-left"
                        >
                          Pod sprint track
                        </th>
                        <th
                          scope="col"
                          className="lbl lbl-teal px-4 pb-3 text-left"
                        >
                          Newcomer track
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCHEDULE.map((s) => (
                        <ScheduleRow key={s.time} slot={s} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden">
                  {SCHEDULE.map((s) => (
                    <ScheduleCard key={s.time} slot={s} />
                  ))}
                </div>
              </div>
            </div>
          </EdSection>

          <EdSection
            eyebrow="The Build Cycle"
            heading="Every quarter, a new Build Cycle. Every Build Cycle, a Pod sprint like this one."
          >
            <div className="ed-cols">
              <div className="stat-row">
                {STATS.map((s) => (
                  <div className="stat-cell" key={s.l}>
                    <div className="stat-num">{s.n}</div>
                    <div className="stat-lbl">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ed-cols">
              <Link className="see" href="/build-cycles">
                How a Build Cycle works →
              </Link>
            </div>
          </EdSection>

          <EdSection eyebrow="With thanks to" heading="Our hosts and sponsors.">
            <div className="ed-cols">
              <Image
                src="/assets/american-university.webp"
                alt="American University"
                width={220}
                height={64}
                style={{ height: 64, width: "auto" }}
              />
            </div>
          </EdSection>
        </div>
      </div>

      {/* ── Register: the closing dark band, same grid as the header ── */}
      <section
        className="grain on-dark"
        style={{ background: "var(--ink)" }}
      >
        <div
          className="container"
          style={{ paddingTop: 88, paddingBottom: 88 }}
        >
          <div className="ed-sec">
            <div className="ed-eyebrow">
              <div className="lbl lbl-teal">Join us August 15</div>
            </div>
            <h2 className="ed-heading t-h2">
              Build something real for civics and elections.
            </h2>
            <div className="ed-cols">
              <p className="t-lede ed-text" style={{ color: "var(--od2)" }}>
                By 4:30 PM, everyone leaves with a working prototype and a plan
                to test it in the real world.
              </p>
            </div>
            <div className="ed-cols">{registerBtn("btn btn-teal")}</div>
          </div>
        </div>
      </section>

      {/* ── Recirculation: a browse section, so the heavy section head is right ── */}
      {related.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  More like this
                </div>
                <h2 className="t-h2">Also coming up</h2>
              </div>
              <Link className="see" href="/events">
                All events →
              </Link>
            </div>
            <div className="cards dense all">
              {related.map((x) => (
                <EventTeaser key={x.slug} event={x} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
