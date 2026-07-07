import { Suspense } from "react";
import EventsAgenda from "@/app/components/content/events-agenda";
import { EditorialHeader } from "@/app/components/chrome/editorial";
import { getEvents } from "@/lib/content/queries";

/* The public events directory — the generator's directoryPage('events'),
   recomposed on the editorial "standards-manual" grid: the dark header (count
   eyebrow + headline own the head row, standfirst beneath), then the shared
   EventsAgenda island (month-grouped upcoming first, past in its own tab,
   filters + search, URL-synced). */


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
    <>
      {/* ── Header: count eyebrow + headline (head row), standfirst (beneath) ── */}
      <EditorialHeader
        eyebrow={`Events & workshops · ${events.length}`}
        title="Drop into a session"
        standfirst="Free and public, every one. ✦ marks the cycle’s anchor events."
      />

      {/* ── Browse: the month-grouped agenda island, full-width ── */}
      <section className="section">
        <div className="container">
          {/* The island reads useSearchParams — Suspense keeps Next happy. */}
          <Suspense>
            <EventsAgenda events={events} nowMs={nowMs} syncUrl />
          </Suspense>
        </div>
      </section>
    </>
  );
}
