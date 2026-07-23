"use client";

import * as React from "react";
import { RecentPulsesFeed } from "./recent-pulses-feed";
import { RecentLogsFeed } from "./recent-logs-feed";

/**
 * The "Recent activity" tab body. A pod practices one weekly instrument
 * in practice - Learning Logs (current) or pulse checks (legacy) - so the
 * view auto-selects whichever has data (owner decision, 2026-07-22):
 *
 *   - logs only (or neither)  -> Learning Logs feed, no switch
 *   - pulses only             -> pulse feed, no switch
 *   - both                    -> Learning Logs default + a switch
 */

export function RecentActivityFeed({
  podId,
  hasLogs = false,
  hasPulses = false,
}: {
  podId: number;
  hasLogs?: boolean;
  hasPulses?: boolean;
}) {
  const both = hasLogs && hasPulses;
  const pulsesOnly = hasPulses && !hasLogs;
  const [view, setView] = React.useState<"logs" | "pulses">(
    pulsesOnly ? "pulses" : "logs"
  );

  return (
    <div>
      {both && (
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
      )}
      {view === "logs" ? (
        <RecentLogsFeed podId={podId} />
      ) : (
        <RecentPulsesFeed podId={podId} />
      )}
    </div>
  );
}
