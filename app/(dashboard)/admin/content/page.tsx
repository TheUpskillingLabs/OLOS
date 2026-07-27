import { requireAdmin } from "@/lib/auth/guards";
import StoriesAdmin, { type AdminSpotlight } from "./stories-admin";
import LibraryAdmin, { type AdminResource } from "./library-admin";
import SyncEventsButton from "./sync-events-button";

/* Public content admin — the Learning Library (link-out resources: guides,
   recordings, Google Docs, …), Upskiller Spotlights (submissions land as
   'submitted'; the Labs team enriches and publishes to /stories), and the
   manual Luma events sync (a cron also runs every 6h). */

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const { serviceClient } = await requireAdmin();

  const [{ data: spotlightData }, { data: resourceData }] = await Promise.all([
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
  ]);

  const rows = (spotlightData as AdminSpotlight[]) ?? [];
  const resources = (resourceData as AdminResource[]) ?? [];

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
          Pull the latest events from Luma into the public events cache now — a
          cron also runs this every 6 hours.
        </p>
        <SyncEventsButton />
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
