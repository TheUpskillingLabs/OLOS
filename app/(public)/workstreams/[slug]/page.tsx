import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EditorialHeader } from "@/app/components/chrome/editorial";
import { StatusBadge } from "@/app/components/ui";
import { getWorkstreamPage } from "@/lib/content/org-pages";
import FollowButton from "@/app/components/follow-button";
import { pageFollowState } from "@/lib/follows/server";

function runVariant(status: string): "active" | "forming" | "inactive" {
  if (status === "active") return "active";
  if (status === "forming") return "forming";
  return "inactive";
}

/* Public workstream detail — a durable unit of internal org work (docs/
   ORG_CYCLES.md), homed under a sector (HQ) or a lab. Its per-cycle "runs" are
   pods carrying workstream_id. Deep-link target for the dashboard left rail's
   "org unit" row (org-mode members). */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getWorkstreamPage(slug);
  if (!data) return { title: "Workstream — The Upskilling Labs" };
  return {
    title: `${data.workstream.name} — The Upskilling Labs`,
    description: data.workstream.description ?? undefined,
  };
}

export default async function WorkstreamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getWorkstreamPage(slug);
  if (!data) notFound();
  const { workstream, home, runs } = data;
  const follow = await pageFollowState({ type: "workstream", id: workstream.id });

  return (
    <>
      <EditorialHeader
        eyebrow="Workstream"
        title={workstream.name}
        standfirst={workstream.description ?? undefined}
      >
        {home && (
          <div className="ed-cols">
            <p className="t-small" style={{ color: "var(--od3)" }}>
              {home.kind === "lab" ? "Local lab" : "Sector"} ·{" "}
              <Link
                href={home.href}
                className="font-semibold text-teal transition-colors duration-150 hover:text-white"
              >
                {home.name}
              </Link>
            </p>
          </div>
        )}
      </EditorialHeader>

      <div className="container" style={{ paddingTop: 48, paddingBottom: 72 }}>
        {follow && (
          <div className="mb-8 flex justify-end">
            <FollowButton
              type="workstream"
              id={workstream.id}
              initialFollowing={follow.following}
            />
          </div>
        )}
        <section>
          <h2 className="t-h3 mb-1 text-ink">Runs</h2>
          <p className="mb-4 text-sm text-meta">
            Each cycle spins up a run of this workstream.
          </p>
          {runs.length === 0 ? (
            <p className="text-sm text-meta">No runs yet.</p>
          ) : (
            <div className="grid gap-3">
              {runs.map((r) => (
                <div
                  key={r.podId}
                  className="flex items-center justify-between gap-3 rounded-card border border-ink/10 bg-white px-4 py-3 shadow-card"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {r.name ?? "Run"}
                    </span>
                    {r.cycleName && (
                      <span className="mt-0.5 block text-xs text-meta">
                        {r.cycleName}
                      </span>
                    )}
                  </span>
                  <StatusBadge variant={runVariant(r.status)}>
                    {r.status}
                  </StatusBadge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
