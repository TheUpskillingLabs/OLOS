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
          <div className="mb-1.5 text-xs uppercase tracking-widest text-teal">
            Across your pods
          </div>
          <h2 className="text-lg font-semibold text-white">Pulse insights</h2>
        </div>
        <RangeToggle range={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-whisper bg-white/[0.02] p-5">
          <div className="mb-3 text-xs uppercase tracking-widest text-cloud/40">
            AI tool adoption by pod
          </div>
          {active.topTools.length === 0 ? (
            <div className="text-sm text-cloud/60">No AI tools named yet.</div>
          ) : (
            <div className="space-y-3">
              {active.topTools.map((row) => (
                <div key={row.tool}>
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-cloud">
                      {row.tool}
                    </span>
                    <span className="text-xs tabular-nums text-cloud/60">
                      {row.members} member{row.members === 1 ? "" : "s"} total
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.byPod.map((p) => (
                      <span
                        key={p.pod_id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-xs text-cloud/75"
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

        <div className="rounded-md border border-whisper bg-white/[0.02] p-5">
          <div className="mb-3 text-xs uppercase tracking-widest text-cloud/40">
            Engagement comparison — this week
          </div>
          {active.engagement.length === 0 ? (
            <div className="text-sm text-cloud/60">No engagement data yet.</div>
          ) : (
            <div className="space-y-2.5">
              {active.engagement.map((row) => {
                const pct = Math.round(row.thisWeekRate * 100);
                return (
                  <div key={row.pod_id} className="flex items-center gap-3">
                    <div className="flex-1 truncate text-xs text-cloud/80">
                      {row.pod_name}
                    </div>
                    <div className="h-2 w-40 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className={`h-full transition-[width] ${
                          pct >= 80
                            ? "bg-aqua"
                            : pct >= 50
                              ? "bg-teal"
                              : "bg-yellow-500/70"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-xs tabular-nums text-cloud/70">
                      {row.thisWeekCompleted}/{row.thisWeekTotal}
                    </div>
                    <div className="w-10 text-right text-xs tabular-nums text-cloud/50">
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
  const baseBtn = "rounded-full px-3 py-1 font-medium transition-colors";
  return (
    <div className="inline-flex items-center gap-1 self-start rounded-full bg-white/[0.04] p-1 text-xs sm:self-auto">
      <button
        onClick={() => onChange("4w")}
        className={`${baseBtn} ${range === "4w" ? "bg-teal/20 text-aqua" : "text-cloud/60 hover:text-cloud"}`}
      >
        Last 4 weeks
      </button>
      <button
        onClick={() => onChange("full")}
        className={`${baseBtn} ${range === "full" ? "bg-teal/20 text-aqua" : "text-cloud/60 hover:text-cloud"}`}
      >
        Full cycle
      </button>
    </div>
  );
}
