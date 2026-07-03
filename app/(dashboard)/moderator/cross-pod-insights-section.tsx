"use client";

import * as React from "react";
import type { CrossPodInsights } from "@/lib/moderator/cross-pod-insights";
import { AISummaryBlock } from "./ai-summary-block";

/**
 * Cross-pod pulse insights (PRD §7.9.3).
 *
 * Renders on the All pods view. Same shape as §7.9.2 with per-pod
 * breakdown. Suppressed for single-pod poderators (caller decides).
 *
 * Range toggle behaves the same as per-pod insights — both ranges
 * pre-computed server-side, switching is local state.
 */
export function CrossPodInsightsSection({
  fourWeeks,
  fullCycle,
  aiSummaryPrompt,
}: {
  fourWeeks: CrossPodInsights;
  fullCycle: CrossPodInsights;
  aiSummaryPrompt: string | null;
}) {
  const [range, setRange] = React.useState<"4w" | "full">("4w");
  const active = range === "4w" ? fourWeeks : fullCycle;

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="lbl lbl-teal mb-1.5">
            Across your pods
          </div>
          <h2 className="t-h3 text-ink">Pulse insights</h2>
        </div>
        <RangeToggle range={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
          <div className="lbl mb-3">
            AI tool adoption by pod
          </div>
          {active.topTools.length === 0 ? (
            <div className="text-sm text-meta">No AI tools named yet.</div>
          ) : (
            <div className="space-y-3">
              {active.topTools.map((row) => (
                <div key={row.tool}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">
                      {row.tool}
                    </span>
                    <span className="text-xs tabular-nums text-meta">
                      {row.members} member{row.members === 1 ? "" : "s"} total
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.byPod.map((p) => (
                      <span
                        key={p.pod_id}
                        className="inline-flex items-center gap-1.5 rounded-sm bg-ink/[0.04] px-2.5 py-0.5 text-xs text-slate"
                      >
                        {p.pod_name}
                        <span className="tabular-nums opacity-80">
                          {p.members}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
          <div className="lbl mb-3">
            Engagement comparison — this week
          </div>
          {active.engagement.length === 0 ? (
            <div className="text-sm text-meta">No engagement data yet.</div>
          ) : (
            <div className="space-y-2.5">
              {active.engagement.map((row) => {
                const pct = Math.round(row.thisWeekRate * 100);
                return (
                  <div key={row.pod_id} className="flex items-center gap-3">
                    <div className="flex-1 truncate text-xs text-charcoal">
                      {row.pod_name}
                    </div>
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-ink/[0.06]">
                      <div
                        className={`h-full transition-[width] ${
                          pct >= 80
                            ? "bg-teal"
                            : pct >= 50
                              ? "bg-teal/50"
                              : "bg-red/70"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-xs tabular-nums text-slate">
                      {row.thisWeekCompleted}/{row.thisWeekTotal}
                    </div>
                    <div className="w-10 text-right text-xs tabular-nums text-meta">
                      {pct}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <AISummaryBlock
          scope="all-pods"
          prompt={aiSummaryPrompt}
          comments={active.recentComments}
          rangeLabel={range === "4w" ? "last 4 weeks" : "full cycle"}
        />
      </div>
    </section>
  );
}

function RangeToggle({
  range,
  onChange,
}: {
  range: "4w" | "full";
  onChange: (r: "4w" | "full") => void;
}) {
  const baseBtn = "rounded-card px-3 py-1 font-medium transition-colors";
  return (
    <div className="inline-flex items-center gap-1 self-start rounded-card bg-ink/[0.04] p-1 text-xs sm:self-auto">
      <button
        onClick={() => onChange("4w")}
        className={`${baseBtn} ${range === "4w" ? "bg-white text-teal-deep shadow-card" : "text-meta hover:text-ink"}`}
      >
        Last 4 weeks
      </button>
      <button
        onClick={() => onChange("full")}
        className={`${baseBtn} ${range === "full" ? "bg-white text-teal-deep shadow-card" : "text-meta hover:text-ink"}`}
      >
        Full cycle
      </button>
    </div>
  );
}
