"use client";

import * as React from "react";
import type { PodInsights } from "@/lib/moderator/pod-insights";
import { AISummaryBlock } from "./ai-summary-block";

/**
 * Pod-level pulse insights (PRD §7.9.2) — top AI tools across the pod
 * + weekly completion trend. Plus the AI-assisted summary block
 * (§7.10.3) bound to the pod scope.
 *
 * Range toggle: 4-week default / full cycle. Both ranges are
 * pre-computed server-side and passed in; switching is local state.
 */
export function PodInsightsSection({
  fourWeeks,
  fullCycle,
  aiSummaryPrompt,
}: {
  fourWeeks: PodInsights;
  fullCycle: PodInsights;
  aiSummaryPrompt: string | null;
}) {
  const [range, setRange] = React.useState<"4w" | "full">("4w");
  const active = range === "4w" ? fourWeeks : fullCycle;

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 text-xs uppercase tracking-widest text-teal">
            For this pod
          </div>
          <h2 className="text-lg font-semibold text-white">Pulse insights</h2>
        </div>
        <RangeToggle range={range} onChange={setRange} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-whisper bg-white/[0.02] p-5">
          <div className="mb-3 text-xs uppercase tracking-widest text-cloud/40">
            Top AI tools
          </div>
          {active.topTools.length === 0 ? (
            <div className="text-sm text-cloud/60">No AI tools named yet.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {active.topTools.map((t, i) => (
                <span
                  key={t.tool}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${
                    i === 0
                      ? "bg-teal/25 text-aqua"
                      : i === 1
                        ? "bg-teal/20 text-aqua"
                        : "bg-teal/10 text-aqua/80"
                  }`}
                >
                  {t.tool}
                  <span className="tabular-nums opacity-80">{t.members}</span>
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 text-xs text-cloud/50">
            Count is members who named the tool, not raw mentions.
          </div>
        </div>

        <div className="rounded-md border border-whisper bg-white/[0.02] p-5 lg:col-span-2">
          <div className="mb-3 text-xs uppercase tracking-widest text-cloud/40">
            Pulse completion trend
          </div>
          {active.weekly.length === 0 ? (
            <div className="text-sm text-cloud/60">No pulse history yet.</div>
          ) : (
            <CompletionBars weekly={active.weekly} />
          )}
        </div>
      </div>

      <div className="mt-4">
        <AISummaryBlock
          scope="pod"
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
  const baseBtn =
    "rounded-full px-3 py-1 font-medium transition-colors";
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

function CompletionBars({
  weekly,
}: {
  weekly: PodInsights["weekly"];
}) {
  return (
    <div className="space-y-2.5">
      {weekly.map((w) => {
        const pct = Math.round(w.rate * 100);
        return (
          <div key={w.scheduled_date} className="flex items-center gap-3">
            <div className="w-24 flex-shrink-0 text-xs tabular-nums text-cloud/60">
              {formatWeek(w.scheduled_date)}
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full bg-teal transition-[width]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-14 text-right text-xs tabular-nums text-cloud/70">
              {w.completed}/{w.total}
            </div>
            <div className="w-10 text-right text-xs tabular-nums text-cloud/50">
              {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
