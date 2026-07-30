import Link from "next/link";
import RsvpButton, { MemberRegister } from "@/app/(public)/events/[slug]/rsvp";
import { fmtDay, fmtTime, fmtMonth } from "@/lib/content/format";
import { featuredEvents } from "@/lib/content/featured";
import { publicSession } from "@/lib/auth/public-session";
import { createServiceClient } from "@/lib/supabase/server";
import type { EventRow } from "@/lib/content/queries";

/* The /events hero — the page headline and the next two anchor events in one
   cover band (owner design, July 2026), replacing the dark EditorialHeader +
   separate featured strip. Translated into the house system rather than
   ported: the mock's flat red becomes the Labs cover gradient (.s-cover, the
   same band as the landing hero — owner call, red stays an accent), Geologica
   type on the .t-* scale, .btn-white / .btn-ghost from the component layer,
   one 14px radius, no pills.

   Two events, not three: the band gives each a half-width column with an
   oversized day numeral, and a third would shrink them back into cards —
   the agenda below already carries the full list.

   The mock's ✦ glyphs and its anchor filter chip are not reproduced; both
   were removed deliberately earlier in this redesign (the numeral treatment
   does the "this one is big" work now), and the All/Workshops/Anchor segments
   in the agenda toolbar remain the way to narrow the list.

   "Reserve a seat" registers directly — members one-tap with their account
   (same MemberRegister as the detail pages, so "You're going ✓" carries
   across), anonymous visitors register on Luma where its questions and photo
   release live, and the email modal covers editorial events Luma doesn't
   know about. "More details" goes to the event's page.

   Server component: it reads the session and the member's RSVPs itself, so
   the page only hands it the event list and the clock. */

export default async function EventsHero({
  events,
  nowMs,
}: {
  events: EventRow[];
  nowMs: number;
}) {
  const featured = featuredEvents(events, nowMs, 2);
  const session = await publicSession();

  // Which featured events is this member already going to? Mirrors the
  // detail page: in-app RSVPs plus, via the guest mirror, Luma registrations.
  const going = new Set<number>();
  if (session.signedIn && session.email && featured.length > 0) {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("event_rsvps")
      .select("event_id")
      .in(
        "event_id",
        featured.map((e) => e.id)
      )
      .eq("email", session.email);
    for (const r of data ?? []) going.add(r.event_id as number);
  }

  return (
    <section className="s-cover grain on-dark">
      <div className="container" style={{ paddingTop: 72, paddingBottom: 64 }}>
        {/* ── Head row: headline left, the standing facts right ── */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h1 className="t-display">Drop into a session</h1>
          {/* No session count here — it churned with every Luma sync and read
              as a claim about how much is on rather than a label. */}
          <div className="lbl" style={{ color: "rgba(255,255,255,0.85)" }}>
            Events &amp; workshops · Free &amp; public
          </div>
        </div>

        <hr
          className="rule"
          style={{
            borderTopColor: "rgba(255,255,255,0.4)",
            margin: "24px 0 0",
          }}
        />

        {/* ── The next anchor events, side by side over a hairline ── */}
        {featured.length > 0 && (
          <div className="grid gap-10 pt-10 md:grid-cols-2">
            {featured.map((e, i) => (
              <FeaturedEvent
                key={e.slug}
                event={e}
                divided={i > 0}
                signedIn={session.signedIn}
                going={going.has(e.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FeaturedEvent({
  event: e,
  divided,
  signedIn,
  going,
}: {
  event: EventRow;
  divided: boolean;
  signedIn: boolean;
  going: boolean;
}) {
  const day = new Date(e.start_at).getDate();
  const month = fmtMonth(e.start_at).split(" ")[0]; // "August 2026" → "August"
  const weekday = fmtDay(e.start_at).split(",")[0]; // "Saturday, Aug 15" → "Saturday"
  const time = `${fmtTime(e.start_at)}${e.end_at ? ` – ${fmtTime(e.end_at)}` : ""}`;
  const where =
    e.location_type === "virtual"
      ? "Virtual"
      : (e.location_name ?? "").split(",")[0].trim() || "In person";

  // The same three-way registration rule as the detail pages. Anonymous
  // visitors on Luma-managed events register on Luma's own page (its
  // questions, photo release included); the email modal remains only for
  // editorial events Luma doesn't know about.
  const reserve = signedIn ? (
    <MemberRegister
      eventId={e.id}
      going={going}
      className="btn btn-white"
      label="Reserve a seat"
    />
  ) : e.luma_url ? (
    <a
      className="btn btn-white"
      href={e.luma_url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Reserve a seat
    </a>
  ) : (
    <RsvpButton
      eventId={e.id}
      name={e.name}
      dateLabel={fmtDay(e.start_at)}
      label="Reserve a seat"
      className="btn btn-white"
    />
  );

  return (
    <article
      className={divided ? "md:border-l md:pl-10" : undefined}
      style={{ borderColor: "rgba(255,255,255,0.35)" }}
    >
      <div className="lbl" style={{ color: "rgba(255,255,255,0.85)" }}>
        Anchor event
      </div>

      {/* The mock's oversized day numeral: the date is the first thing a
          drop-in visitor needs, so it gets display type. */}
      <div className="flex items-start gap-5" style={{ marginTop: 14 }}>
        <div className="t-display tabular-nums" aria-hidden>
          {day}
        </div>
        <div style={{ minWidth: 0, paddingTop: 6 }}>
          <div className="lbl" style={{ color: "rgba(255,255,255,0.85)" }}>
            {month}
          </div>
          <h2 className="t-h2" style={{ marginTop: 4 }}>
            <Link
              href={`/events/${e.slug}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {e.name}
            </Link>
          </h2>
        </div>
      </div>

      {e.description && (
        <p
          className="t-body ed-text"
          style={{ color: "rgba(255,255,255,0.92)", marginTop: 12 }}
        >
          {e.description}
        </p>
      )}
      <p
        className="t-small"
        style={{ color: "rgba(255,255,255,0.8)", marginTop: 8 }}
      >
        {weekday} · {time} · {where} · {e.cost || "Free"}
      </p>

      <div
        className="flex flex-wrap items-center gap-3"
        style={{ marginTop: 20 }}
      >
        {reserve}
        <Link className="btn btn-ghost" href={`/events/${e.slug}`}>
          More details
        </Link>
      </div>
    </article>
  );
}
