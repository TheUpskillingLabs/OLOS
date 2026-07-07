import { EventTeaser } from "@/app/components/content/teasers";
import { DocBar, EditorialHeader } from "@/app/components/chrome/editorial";
import { getEvents } from "@/lib/content/queries";

/* The public events directory — the generator's directoryPage('events'),
   recomposed on the editorial "standards-manual" grid: the document bar, the
   dark header (count eyebrow + headline own the head row, standfirst beneath),
   then the full teaser grid full-width. Copy ported byte-for-byte from
   tools/generate.js. */


// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Events & workshops · The Upskilling Labs",
  description:
    "Free, public, hands-on. Drop into a session — or into the cycle’s six anchor events.",
};

export default async function EventsPage() {
  // getEvents() orders by start_at ascending — the generator's sort.
  const events = await getEvents();

  return (
    <>
      <DocBar trail={[["Home", "/"], ["Events", null]]} tag="The Upskilling Labs · Events" />

      {/* ── Header: count eyebrow + headline (head row), standfirst (beneath) ── */}
      <EditorialHeader
        eyebrow={`Events & workshops · ${events.length}`}
        title="Drop into a session"
        standfirst="Free and public, every one. ✦ marks the cycle’s six anchor events."
      />

      {/* ── Browse: the full teaser grid, full-width ── */}
      <section className="section">
        <div className="container">
          <div className="cards dense all">
            {events.map((e) => (
              <EventTeaser key={e.slug} event={e} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
