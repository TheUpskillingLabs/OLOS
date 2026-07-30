import Link from "next/link";
import { MediaFrame } from "./teasers";
import { fmtDay, fmtTime } from "@/lib/content/format";
import type { EventRow } from "@/lib/content/queries";

/* The selection rule lives in lib/content/featured.ts (pure, unit-tested);
   this file is only how it looks. */

/* The featured strip at the top of /events — the next anchor events, given the
   top of the page instead of a ✦ on a card and a filter chip most visitors
   never pressed. Three at most: enough to read the rhythm of a cycle, few
   enough to stay one row on desktop and not push the agenda below the fold on
   mobile.

   These are the same rows the agenda renders further down. That repetition is
   deliberate: the strip answers "what is the big thing coming up", the agenda
   answers "what is on". Filtering them out of the agenda would make the month
   groups lie. */

function FeaturedCard({ event: e }: { event: EventRow }) {
  const when = `${fmtDay(e.start_at)} · ${fmtTime(e.start_at)}${
    e.end_at ? `–${fmtTime(e.end_at)}` : ""
  }`;
  // The venue, not cityOf()'s city: these cards are wide enough for it, and
  // "American University" tells a reader more than "Washington" does when the
  // question is whether to show up.
  const venue = e.location_name?.split(",")[0].trim();
  const where =
    e.location_type === "virtual" ? "Virtual" : venue || "In person";

  return (
    <Link className="card tappable" href={`/events/${e.slug}`}>
      {/* No kind tag: every one of these is an Anchor and the section heading
          two lines up already says so. */}
      <MediaFrame img={e.img} grad={e.grad} />
      <div className="card-body">
        <div className="lbl lbl-teal">{when}</div>
        <div className="t-h3" style={{ margin: "8px 0 6px" }}>
          {e.name}
        </div>
        {e.description && (
          <p className="t-small" style={{ marginBottom: 10 }}>
            {e.description}
          </p>
        )}
        <p className="t-small" style={{ color: "var(--teal-deep)" }}>
          {where} · {e.cost || "Free"}
        </p>
      </div>
    </Link>
  );
}

export default function FeaturedEvents({ events }: { events: EventRow[] }) {
  if (events.length === 0) return null;
  return (
    <section className="section" style={{ paddingBottom: 0 }}>
      <div className="container">
        <div className="section-head">
          <div>
            {/* "The cycle's ..." read as membership — as though you had to be
                in the cycle to come. These are free and public like everything
                else on the page, so the heading says when, not whose. */}
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
              Anchor events
            </div>
            <h2 className="t-h2">Coming up next</h2>
          </div>
          <Link className="see" href="/build-cycles">
            How a cycle works &rarr;
          </Link>
        </div>
        <div className="cards three">
          {events.map((e) => (
            <FeaturedCard key={e.slug} event={e} />
          ))}
        </div>
      </div>
    </section>
  );
}
