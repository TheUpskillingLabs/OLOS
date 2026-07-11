import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialHeader } from "@/app/components/chrome/editorial";
import { StatusBadge } from "@/app/components/ui";
import { cycleStatusVariant, workstreamStatusVariant } from "@/lib/cycle/labels";
import { formatDate } from "@/lib/format/date";
import { getSectorPage } from "@/lib/content/org-pages";
import FollowButton from "@/app/components/follow-button";
import { resolvePageContext } from "@/lib/pages/server";
import PageUpdatesSection from "@/app/(dashboard)/page-updates-section";

/* Public sector detail — the durable, cross-cohort home for a theme's cohorts
   and teams (docs/SECTOR_MODEL.md). Deep-link target for the dashboard left
   rail's "org unit" row. Mirrors the local-labs/[slug] public-page pattern. */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSectorPage(slug);
  if (!data) return { title: "Sector — The Upskilling Labs" };
  return {
    title: `${data.sector.name} — The Upskilling Labs`,
    description: data.sector.description ?? undefined,
  };
}

export default async function SectorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getSectorPage(slug);
  if (!data) notFound();
  const { sector, cycles, workstreams } = data;
  const ctx = await resolvePageContext("sector", sector.id);

  return (
    <>
      <EditorialHeader
        eyebrow="Sector"
        title={sector.name}
        standfirst={sector.description ?? undefined}
      />

      <div className="container" style={{ paddingTop: 48, paddingBottom: 72 }}>
        {ctx.viewerId != null && (
          <div className="mb-8 flex justify-end">
            <FollowButton
              type="sector"
              id={sector.id}
              initialFollowing={ctx.following}
            />
          </div>
        )}
        <section className="mb-10">
          <h2 className="t-h3 mb-4 text-ink">Cycles</h2>
          {cycles.length === 0 ? (
            <p className="text-sm text-meta">No cycles under this sector yet.</p>
          ) : (
            <div className="grid gap-3">
              {cycles.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-card border border-ink/10 bg-white px-4 py-3 shadow-card"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {c.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-meta">
                      {c.mode === "org" ? "Internal" : "Participant"} ·{" "}
                      {formatDate(c.start_date)} &ndash; {formatDate(c.end_date)}
                    </span>
                  </span>
                  <StatusBadge variant={cycleStatusVariant(c.status)}>
                    {c.status}
                  </StatusBadge>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="t-h3 mb-4 text-ink">Workstreams</h2>
          {workstreams.length === 0 ? (
            <p className="text-sm text-meta">
              No workstreams under this sector yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {workstreams.map((w) => (
                <Link
                  key={w.id}
                  href={`/workstreams/${w.slug}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-ink/10 bg-white px-4 py-3 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <span className="truncate text-sm font-semibold text-ink">
                    {w.name}
                  </span>
                  <StatusBadge variant={workstreamStatusVariant(w.status)}>
                    {w.status}
                  </StatusBadge>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Members-only: page updates are 'labs' visibility, so the feed shows
            only to signed-in members (this page is public). */}
        {ctx.viewerId != null && (
          <section className="mt-10">
            <PageUpdatesSection
              type="sector"
              id={sector.id}
              name={sector.name}
              ctx={ctx}
            />
          </section>
        )}
      </div>
    </>
  );
}
