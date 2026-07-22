"use client";

import * as React from "react";
import { RecentPulsesFeed } from "./recent-pulses-feed";
import { RecentLogsFeed } from "./recent-logs-feed";

/**
 * The "Recent activity" tab body: a two-way switch between the pod's
 * Learning Logs (the current weekly instrument, default) and pulse
 * checks (the legacy instrument). Mixing both in one stream read as
 * confusing (owner feedback, 2026-07-22), so each gets its own view.
 */

export function RecentActivityFeed({ podId }: { podId: number }) {
  const [view, setView] = React.useState<"logs" | "pulses">("logs");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Activity type"
        className="mb-4 inline-flex rounded-card border border-ink/10 bg-white p-0.5 shadow-card"
      >
        {(
          [
            ["logs", "Learning Logs"],
            ["pulses", "Pulse checks"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={view === value}
            onClick={() => setView(value)}
            className={`rounded-[10px] px-3 py-1.5 text-sm transition-colors ${
              view === value
                ? "bg-teal/10 font-semibold text-teal-deep"
                : "text-meta hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === "logs" ? (
        <RecentLogsFeed podId={podId} />
      ) : (
        <RecentPulsesFeed podId={podId} />
      )}
    </div>
  );
}
