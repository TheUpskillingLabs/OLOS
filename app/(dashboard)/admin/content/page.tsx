import { requireAdmin } from "@/lib/auth/guards";
import StoriesAdmin, { type AdminSpotlight } from "./stories-admin";
import LibraryAdmin, { type AdminResource } from "./library-admin";
import EventsAdmin, { type AdminEvent } from "./events-admin";
import SyncEventsButton from "./sync-events-button";

/* Public content admin — the Learning Library (link-out resources: guides,
   recordings, Google Docs, …), Upskiller Spotlights (submissions land as
   'submitted'; the Labs team enriches and publishes to /stories), and the
   manual Luma events sync (a cron also runs every 6h). */

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const { serviceClient } = await requireAdmin();

  // Upcoming only for the events editor: the point of dressing an event is
  // the moment before people decide to come. start_at is a naive local
  // timestamp; a date-only cutoff keeps today's events in the list.
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: spotlightData }, { data: resourceData }, { data: eventData }] =
    await Promise.all([
    serviceClient
      .from("spotlights")
      .select(
        "id, slug, name, role, tag, tag_label, quote, story, grad, submitter_email, status, sort_order, created_at"
      )
      .order("created_at", { ascending: false }),
    serviceClient
      .from("resources")
      .select(
        "id, slug, title, content_type, url, summary, meta, author, status, created_at"
      )
      .order("created_at", { ascending: false }),
    serviceClient
      .from("events")
      .select(
        "id, slug, name, kind, anchor, start_at, status, description, bring, body, synced_at"
      )
      .eq("status", "published")
      .gte("start_at", today)
      .order("start_at", { ascending: true }),
  ]);

  const rows = (spotlightData as AdminSpotlight[]) ?? [];
  const resources = (resourceData as AdminResource[]) ?? [];
  const events = (eventData as AdminEvent[]) ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="t-h1 text-ink">Content</h1>
        <p className="mt-1 text-sm text-meta">
          Public content — Upskiller Spotlights and the Luma events cache.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="mb-1 t-h3 text-ink">Learning Library</h2>
        <p className="mb-4 text-sm text-meta">
          Add and manage resources — guides, recordings, templates, and links
          out to view-only Google Docs. Published resources show on the public
          /library and in members&apos; Learning tab.
        </p>
        <LibraryAdmin initial={resources} />
      </section>

      <hr className="mb-10 border-ink/10" />

      <section className="mb-10">
        <h2 className="mb-1 t-h3 text-ink">Events</h2>
        <p className="mb-4 text-sm text-meta">
          The facts (name, time, venue, cover) come from Luma and can only be
          changed there. What you edit here is the editorial layer — the lede,
          the &ldquo;what we&apos;ll cover&rdquo; items, the bring line — and
          it survives every sync.
        </p>
        <EventsAdmin initial={events} />
        <div className="mt-4">
          <p className="mb-2 text-sm text-meta">
            Pull the latest events from Luma now — a cron also runs this every
            6 hours.
          </p>
          <SyncEventsButton />
        </div>
      </section>

      <hr className="mb-10 border-ink/10" />

      <section>
        <h2 className="mb-1 t-h3 text-ink">Upskiller Spotlights</h2>
        <p className="mb-4 text-sm text-meta">
          Review submissions, edit the story, and publish to the public /stories
          page.
        </p>
        <StoriesAdmin initial={rows} />
      </section>
    </div>
  );
}
