import { requireAdmin } from "@/lib/auth/guards";
import StoriesAdmin, { type AdminSpotlight } from "./stories-admin";
import SyncEventsButton from "./sync-events-button";

/* Public content admin — Upskiller Spotlights (submissions land as 'submitted';
   the Labs team enriches and publishes to /stories) plus the manual Luma events
   sync (a cron also runs every 6h). */

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const { serviceClient } = await requireAdmin();

  const { data } = await serviceClient
    .from("spotlights")
    .select(
      "id, slug, name, role, tag, tag_label, quote, story, grad, submitter_email, status, sort_order, created_at"
    )
    .order("created_at", { ascending: false });

  const rows = (data as AdminSpotlight[]) ?? [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="t-h1 text-ink">Content</h1>
        <p className="mt-1 text-sm text-meta">
          Public content — Upskiller Spotlights and the Luma events cache.
        </p>
      </div>

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
