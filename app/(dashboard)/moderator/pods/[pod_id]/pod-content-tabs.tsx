"use client";

import * as React from "react";
import type { RosterRow } from "@/lib/moderator/pod-detail";
import type { PodTab } from "@/lib/moderator/ui-state";
import { RosterTable } from "./roster-table";
import { RecentActivityFeed } from "./recent-activity-feed";
import { persistUiState } from "../../switcher";

/**
 * Tabbed wrapper for the per-pod page's main content area.
 *
 * Two tabs:
 *   - Members         → the existing RosterTable + pulse-review side panel
 *   - Recent activity → Learning Logs feed (default) + pulse checks toggle
 *
 * Initial tab comes from the server (read from moderator_ui_state.last_pod_tab).
 * Every tab change persists via PUT /api/moderator/ui-state so the next
 * visit lands on the same tab.
 *
 * B-5: org workstream runs don't file pulse checks, so the "Recent
 * pulses" tab is hidden on `mode === "org"`. A persisted `recent_pulses`
 * initial tab from before a pod's cycle mode mattered (or a stale
 * cross-cycle read) falls back to the members tab.
 */

// The activity tab keeps its historical `recent_pulses` value so persisted
// moderator_ui_state.last_pod_tab rows stay valid; the label and body moved
// on to cover Learning Logs (default) + pulse checks behind a toggle.
const TABS: { value: PodTab; label: string }[] = [
  { value: "members", label: "Members" },
  { value: "recent_pulses", label: "Recent activity" },
];

export function PodContentTabs({
  members,
  podId,
  podName,
  initialTab,
  mode,
  hasLogs = false,
  hasPulses = false,
}: {
  members: RosterRow[];
  podId: number;
  podName: string;
  initialTab: PodTab;
  mode?: string | null;
  hasLogs?: boolean;
  hasPulses?: boolean;
}) {
  const isOrg = mode === "org";
  const tabs = isOrg ? TABS.filter((t) => t.value !== "recent_pulses") : TABS;
  const [tab, setTab] = React.useState<PodTab>(
    isOrg && initialTab === "recent_pulses" ? "members" : initialTab
  );

  const onSelect = (next: PodTab) => {
    if (next === tab) return;
    setTab(next);
    persistUiState({ last_pod_tab: next });
  };

  return (
    <section>
      <div className="mb-3 flex items-center gap-1 border-b border-ink/10">
        {tabs.map((t) => {
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
      {tab === "recent_pulses" && !isOrg && (
        <RecentActivityFeed
          podId={podId}
          hasLogs={hasLogs}
          hasPulses={hasPulses}
        />
      )}
    </section>
  );
}
