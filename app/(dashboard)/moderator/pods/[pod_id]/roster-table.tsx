"use client";

import * as React from "react";
import type { RosterRow } from "@/lib/moderator/pod-detail";
import { PulseReviewPanel } from "./pulse-review-panel";

/**
 * Roster table — Client Component wrapper so each row can open the
 * pulse review side panel (§7.4). The page passes the full roster +
 * pod metadata; row click sets the selected participant and the panel
 * fetches their pulse history on demand.
 *
 * Per PRD: inactive members are hidden by default. A "Show inactive"
 * toggle surfaces them. Filter/sort/search persistence is step 9 of
 * the build order — this component owns local toggle state only.
 */

const PULSE_STATUS_LABEL: Record<RosterRow["pulse_status"], string> = {
  current: "current",
  pending: "pending",
  late: "late",
  at_risk: "at risk",
};

const PULSE_STATUS_COLOR: Record<RosterRow["pulse_status"], string> = {
  current: "bg-teal/20 text-aqua",
  pending: "bg-white/[0.06] text-cloud/70",
  late: "bg-yellow-500/20 text-yellow-300",
  at_risk: "bg-red-500/20 text-red-300",
};

const AI_LEVEL_LABEL: Record<string, string> = {
  new: "New to AI",
  consumer: "AI consumer",
  builder: "AI builder",
  shipper: "AI shipper",
};

export function RosterTable({
  members,
  podId,
  podName,
}: {
  members: RosterRow[];
  podId: number;
  podName: string;
}) {
  const [showInactive, setShowInactive] = React.useState(false);
  const [selected, setSelected] = React.useState<RosterRow | null>(null);

  const active = members.filter((m) => !m.is_inactive);
  const inactive = members.filter((m) => m.is_inactive);
  const visible = showInactive ? members : active;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Members</h2>
        <div className="flex items-center gap-3 text-xs text-cloud/60">
          <span>
            {active.length} active
            {inactive.length > 0 && ` · ${inactive.length} inactive`}
          </span>
          {inactive.length > 0 && (
            <button
              onClick={() => setShowInactive((v) => !v)}
              className="text-aqua transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
            >
              {showInactive ? "Hide inactive" : "Show inactive"}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-whisper">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.02]">
            <tr className="text-xs uppercase tracking-widest text-cloud/40">
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">AI level</th>
              <th className="px-4 py-3 font-medium">Availability</th>
              <th className="px-4 py-3 font-medium">Pulse</th>
              <th className="px-4 py-3 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr
                key={m.participant_id}
                onClick={() => setSelected(m)}
                className={`cursor-pointer border-t border-whisper transition-colors hover:bg-white/[0.03] ${
                  m.is_inactive ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.08] text-xs font-semibold text-cloud">
                      {m.initials}
                    </div>
                    <div className="font-medium text-white">{m.display_name}</div>
                    {m.is_inactive && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-cloud/60">
                        inactive
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-cloud/70">
                  {AI_LEVEL_LABEL[m.ai_experience_level] ?? m.ai_experience_level}
                </td>
                <td className="px-4 py-3 text-cloud/70">
                  {m.availability_snippet ?? (
                    <span className="text-cloud/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PULSE_STATUS_COLOR[m.pulse_status]}`}
                  >
                    {PULSE_STATUS_LABEL[m.pulse_status]}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-cloud/70">
                  {m.last_activity_at ? (
                    `${daysAgo(m.last_activity_at)} days ago`
                  ) : (
                    <span className="text-cloud/40">no pulse yet</span>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr className="border-t border-whisper">
                <td
                  className="px-4 py-6 text-center text-cloud/60"
                  colSpan={5}
                >
                  {active.length === 0
                    ? "No active members in this pod."
                    : "No members match the current filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PulseReviewPanel
        open={selected !== null}
        onClose={() => setSelected(null)}
        member={selected}
        podId={podId}
        podName={podName}
      />
    </section>
  );
}

function daysAgo(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}
