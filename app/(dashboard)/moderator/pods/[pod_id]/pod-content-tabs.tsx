"use client";

import * as React from "react";
import type { RosterRow } from "@/lib/moderator/pod-detail";
import type { PodTab } from "@/lib/moderator/ui-state";
import { RosterTable } from "./roster-table";
import { RecentPulsesFeed } from "./recent-pulses-feed";
import { persistUiState } from "../../switcher";

/**
 * Tabbed wrapper for the per-pod page's main content area.
 *
 * Two tabs:
 *   - Members         → the existing RosterTable + pulse-review side panel
 *   - Recent pulses   → cross-member chronological feed (chunk B)
 *
 * Initial tab comes from the server (read from moderator_ui_state.last_pod_tab).
 * Every tab change persists via PUT /api/moderator/ui-state so the next
 * visit lands on the same tab.
 */

const TABS: { value: PodTab; label: string }[] = [
  { value: "members", label: "Members" },
  { value: "recent_pulses", label: "Recent pulses" },
];

export function PodContentTabs({
  members,
  podId,
  podName,
  initialTab,
}: {
  members: RosterRow[];
  podId: number;
  podName: string;
  initialTab: PodTab;
}) {
  const [tab, setTab] = React.useState<PodTab>(initialTab);

  const onSelect = (next: PodTab) => {
    if (next === tab) return;
    setTab(next);
    persistUiState({ last_pod_tab: next });
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-1 border-b border-ink/10">
        {TABS.map((t) => {
          const active = t.value === tab;
          return (
            <button
              key={t.value}
              onClick={() => onSelect(t.value)}
              className={`relative -mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-teal text-ink"
                  : "border-transparent text-meta hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "members" && (
        <RosterTable members={members} podId={podId} podName={podName} />
      )}
      {tab === "recent_pulses" && <RecentPulsesFeed podId={podId} />}
    </section>
  );
}
