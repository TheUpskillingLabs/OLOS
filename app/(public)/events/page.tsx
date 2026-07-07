import { Suspense } from "react";
import EventsAgenda from "@/app/components/content/events-agenda";
import { getEvents } from "@/lib/content/queries";

/* The public events directory — month-grouped agenda over the generator's
   directoryPage('events') shell: the section-head with the count eyebrow,
   the lede, then the shared EventsAgenda island (upcoming first under month
   headers, past in its own tab, filters + search, URL-synced). */


// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Events & workshops · The Upskilling Labs",
  description:
    "Free, public, hands-on. Drop into a session — or into the cycle’s six anchor events.",
};

export default async function EventsPage() {
  // getEvents() orders by start_at ascending — the agenda splits/groups it.
  const events = await getEvents();

  // Server clock, passed down so the SSR and hydrated upcoming/past splits
  // agree with the island's in-progress rule (end_at fallback start_at).
  const nowMs = new Date().getTime();

  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
              Events & workshops
            </div>
            <h1 className="t-h2">Drop into a session</h1>
          </div>
        </div>
        <p className="t-small" style={{ marginTop: -10, marginBottom: 14 }}>
          Free and public, every one. ✦ marks the cycle’s anchor events.
        </p>
        {/* The island reads useSearchParams — Suspense keeps Next happy. */}
        <Suspense>
          <EventsAgenda events={events} nowMs={nowMs} syncUrl />
        </Suspense>
      </div>
    </section>
  );
}
