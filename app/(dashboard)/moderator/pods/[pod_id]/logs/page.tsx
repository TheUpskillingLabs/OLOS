// Learning & Milestone Logs — the pod's weekly practice and its evaluation
// checkpoints on one page (design doc §3, merged per HQ 2026-08-02). Three
// stacked cards: log health (sentiment dials + blocked-first + compliance),
// the recent-logs feed, and milestone status. The range filter scopes the
// health lookback and the feed floor; the compliance strip is always the
// current gate window.

import Link from "next/link";
import { getPodContext } from "@/lib/moderator/pod-context";
import { parseRange, rangeSince } from "@/lib/moderator/range";
import PodSquadSections from "../pod-squad-sections";
import PodMilestoneLogs from "../pod-milestone-logs";
import { RecentLogsFeed } from "../recent-logs-feed";
import { RangeToggle } from "../_nav/range-toggle";

export const dynamic = "force-dynamic";

export default async function PodLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ pod_id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { pod_id } = await params;
  const ctx = await getPodContext(pod_id);
  const range = parseRange((await searchParams).range);
  const since = rangeSince(range);
  const lookbackDays = range === "week" ? 7 : range === "4w" ? 28 : 365;

  return (
    <div>
      <h1 className="t-h1 text-ink">Learning &amp; Milestone Logs</h1>
      <p className="mt-1 text-sm text-slate">
        The pod&rsquo;s weekly practice and evaluation checkpoints. Status
        only, never a grade.
      </p>
      <div className="mb-6 mt-3">
        <RangeToggle current={range} />
      </div>

      <PodSquadSections
        cycleId={ctx.detail.cycle_id}
        members={ctx.detail.members}
        sections={["log_health"]}
        logLookbackDays={lookbackDays}
      />

      <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="t-h3 text-ink">Log entries</h2>
          {/* The AI-assisted summary lives on the Insights page (its nav
              destination) — one canonical home, pointed to from here where
              a poderator is most likely to want it. */}
          <Link
            href={`/moderator/pods/${ctx.podId}/insights`}
            className="text-xs font-semibold text-teal-deep hover:underline"
          >
            AI-assisted summary &rarr;
          </Link>
        </div>
        <p className="mt-1 text-xs text-meta">
          Newest first, within the selected range.
        </p>
        <div className="mt-3">
          <RecentLogsFeed podId={ctx.podId} since={since} />
        </div>
      </section>

      <PodMilestoneLogs cycleId={ctx.detail.cycle_id} members={ctx.detail.members} />
    </div>
  );
}
