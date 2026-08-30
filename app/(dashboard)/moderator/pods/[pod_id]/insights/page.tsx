// Insights — the pod's AI-assisted Learning Log summary, forefronted as its
// own nav destination (2026-08-30). This page REPLACES Pulse Insights, whose
// instrument the July Learning Log pivot retired for new cycles; the old
// route redirects here.
//
// Data contract (deliberate): presentation-only. It READS learning_logs (the
// bundle) and pulse_checks (via the existing getPodInsights loader) — no
// table is written, altered, or joined across; the two sections are fully
// independent. The pulse charts render ONLY when the pod actually has pulse
// rows — true for cycle-1 cohorts, never for log-era pods — so the empty
// pulse cards this page used to show on new cycles are gone, while cycle-1
// history stays reachable under a "historical" divider. Data-driven, no
// era/config hardcoding.

import { redirect } from "next/navigation";
import { getPodContext } from "@/lib/moderator/pod-context";
import { getPodInsights } from "@/lib/moderator/pod-insights";
import { parseRange, rangeSince } from "@/lib/moderator/range";
import { RangeToggle } from "../_nav/range-toggle";
import { PodInsightsSection } from "../insights-section";
import { LogInsightsSection } from "../log-insights-section";

export const dynamic = "force-dynamic";

export default async function PodInsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ pod_id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { pod_id } = await params;
  const ctx = await getPodContext(pod_id);

  // Org workstreams have neither instrument surfaced here (nav hides the
  // item; direct URLs bounce) — same contract the pulse page had.
  if (ctx.detail.cycle_mode === "org") {
    redirect(`/moderator/pods/${ctx.podId}`);
  }

  const range = parseRange((await searchParams).range);
  const since = rangeSince(range);

  const [fourWeeks, fullCycle, aiPromptRow] = await Promise.all([
    getPodInsights(ctx.serviceClient, ctx.podId, "4w"),
    getPodInsights(ctx.serviceClient, ctx.podId, "full"),
    ctx.serviceClient
      .from("cycle_config")
      .select("ai_summary_prompt")
      .eq("cycle_id", ctx.detail.cycle_id)
      .maybeSingle(),
  ]);
  if (!fourWeeks || !fullCycle) {
    // getPodInsights returns null when the pod vanished mid-request.
    redirect("/moderator");
  }

  // Any pulse signal at all across the full cycle = this pod ran the old
  // instrument; show its history. Log-era pods have zero rows on every axis.
  const hasPulseHistory =
    fullCycle.weekly.length > 0 ||
    fullCycle.recentComments.length > 0 ||
    fullCycle.topTools.length > 0 ||
    fullCycle.depth.length > 0;

  const aiSummaryPrompt =
    (aiPromptRow?.data?.ai_summary_prompt as string | null) ?? null;

  return (
    <div>
      <h1 className="t-h1 text-ink">Insights</h1>
      <p className="mt-1 text-sm text-slate">
        Your pod&rsquo;s Learning Logs, bundled for your AI tool of choice —
        partially anonymized, aggregate-minded, never a grade.
      </p>
      <div className="mb-6 mt-3">
        <RangeToggle current={range} />
      </div>

      <LogInsightsSection
        cycleId={ctx.detail.cycle_id}
        memberIds={ctx.detail.members
          .filter((m) => !m.is_staff_or_test && !m.is_inactive)
          .map((m) => m.participant_id)}
        since={since}
        rangeLabel={
          range === "week"
            ? "last 7 days"
            : range === "4w"
              ? "last 4 weeks"
              : "full cycle"
        }
      />

      {hasPulseHistory && (
        <section className="mt-10">
          <div className="mb-4 border-t border-ink/10 pt-6">
            <h2 className="t-h3 text-ink">Pulse (historical)</h2>
            <p className="mt-1 text-xs text-meta">
              This pod ran the earlier pulse-check instrument. Trends and
              comment analysis below; aggregate only, never per-member
              attribution.
            </p>
          </div>
          <PodInsightsSection
            fourWeeks={fourWeeks}
            fullCycle={fullCycle}
            aiSummaryPrompt={aiSummaryPrompt}
          />
        </section>
      )}
    </div>
  );
}
