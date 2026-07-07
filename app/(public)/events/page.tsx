import { EventTeaser } from "@/app/components/content/teasers";
import { getEvents } from "@/lib/content/queries";

/* The public events directory — the generator's directoryPage('events'):
   crumbs, the section-head with the count eyebrow, the lede, and the full
   teaser grid. Copy ported byte-for-byte from tools/generate.js. */


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
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                Events & workshops · {events.length}
              </div>
              <h1 className="t-h2">Drop into a session</h1>
            </div>
          </div>
          <p className="t-lede" style={{ marginBottom: 28 }}>
            Free and public, every one. ✦ marks the cycle’s six anchor events.
          </p>
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
