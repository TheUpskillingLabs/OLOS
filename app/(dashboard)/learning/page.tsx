import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getEvents, getResources } from "@/lib/content/queries";
import { getSavedSlugs } from "@/lib/content/saved";
import { EventTeaser, ResourceTeaser } from "@/app/components/content/teasers";
import SaveButton from "./save-button";

/* Learning — the signed-in catalog (onboarding-proto's panel-learning): the
   full Events + Library grids plus a "Saved" vertical from the member's hearts.
   Every card links to its real public page; the heart toggles saved_items.
   The (dashboard) layout already guards auth + the weekly log gate; this page
   re-resolves the participant for its saved-state lookup. */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Learning · The Upskilling Labs",
  description: "Sessions, guides, and what you've saved.",
};

export default async function LearningPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: participant } = await service
    .from("participants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!participant) redirect("/register");

  const [events, resources, saved] = await Promise.all([
    getEvents(),
    getResources(),
    getSavedSlugs((participant as { id: number }).id),
  ]);

  // Upcoming events first, then past as history.
  const now = new Date();
  const orderedEvents = [
    ...events.filter((e) => new Date(e.start_at) >= now),
    ...events.filter((e) => new Date(e.start_at) < now),
  ];

  const savedEvents = events.filter((e) => saved.events.has(e.slug));
  const savedResources = resources.filter((r) => saved.resources.has(r.slug));
  const savedCount = savedEvents.length + savedResources.length;

  const eventCorner = (slug: string) => (
    <SaveButton itemType="event" slug={slug} initialSaved={saved.events.has(slug)} />
  );
  const resourceCorner = (slug: string) => (
    <SaveButton itemType="resource" slug={slug} initialSaved={saved.resources.has(slug)} />
  );

  return (
    <div>
      {/* Header + jump chips */}
      <div className="mb-8">
        <p className="lbl lbl-teal mb-1.5">Learning</p>
        <h1 className="t-h1 text-ink">Sessions, guides, and what you&apos;ve saved</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="chip" href="#events">
            Events
          </a>
          <a className="chip" href="#library">
            Library
          </a>
          <a className="chip" href="#saved">
            Saved{savedCount > 0 ? ` · ${savedCount}` : ""}
          </a>
        </div>
      </div>

      {/* Events */}
      <section id="events" className="mb-12 scroll-mt-24">
        <div className="section-head">
          <div>
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
              Workshops &amp; sessions
            </div>
            <h2 className="t-h2">Drop into a session</h2>
          </div>
        </div>
        {orderedEvents.length ? (
          <div className="cards dense all">
            {orderedEvents.map((e) => (
              <EventTeaser key={e.slug} event={e} corner={eventCorner(e.slug)} />
            ))}
          </div>
        ) : (
          <div className="lcard" style={{ padding: 48 }}>
            <div className="t-h3">No sessions scheduled yet</div>
          </div>
        )}
      </section>

      {/* Library */}
      <section id="library" className="mb-12 scroll-mt-24">
        <div className="section-head">
          <div>
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
              Learning Library
            </div>
            <h2 className="t-h2">Learn at your own pace</h2>
          </div>
        </div>
        {resources.length ? (
          <div className="cards dense all">
            {resources.map((r) => (
              <ResourceTeaser key={r.slug} resource={r} corner={resourceCorner(r.slug)} />
            ))}
          </div>
        ) : (
          <div className="lcard" style={{ padding: 48 }}>
            <div className="t-h3">Coming soon</div>
          </div>
        )}
      </section>

      {/* Saved */}
      <section id="saved" className="scroll-mt-24">
        <div className="section-head">
          <div>
            <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
              Your bookmarks
            </div>
            <h2 className="t-h2">Saved</h2>
          </div>
        </div>
        {savedCount ? (
          <div className="cards dense all">
            {savedEvents.map((e) => (
              <EventTeaser key={`e-${e.slug}`} event={e} corner={eventCorner(e.slug)} />
            ))}
            {savedResources.map((r) => (
              <ResourceTeaser key={`r-${r.slug}`} resource={r} corner={resourceCorner(r.slug)} />
            ))}
          </div>
        ) : (
          <div className="lcard" style={{ padding: 40 }}>
            <p className="t-body text-meta">
              Nothing saved yet. Tap the heart on any session or guide to keep it
              here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
