"use client";

import * as React from "react";
import type { RosterRow } from "@/lib/moderator/pod-detail";
import { PulseReviewPanel } from "./pulse-review-panel";
import { persistUiState } from "../../switcher";
import { ManagedTooltip } from "../../tooltip-state";
import type { RosterFilters, RosterSort } from "@/lib/moderator/ui-state";

/**
 * Roster table — Client Component with filter/sort controls and a row
 * click that opens the pulse review side panel (§7.4).
 *
 * Filter + sort state is loaded from /api/moderator/ui-state on mount
 * (best-effort; failures fall back to defaults) and persisted on every
 * user change. PRD §7.7: filter/sort persist per poderator across
 * sessions.
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

const AI_LEVELS = ["new", "consumer", "builder", "shipper"] as const;
const PULSE_STATUSES = ["current", "pending", "late", "at_risk"] as const;

const SORT_OPTIONS: { value: RosterSort; label: string }[] = [
  { value: "joined_at_asc", label: "Joined (oldest)" },
  { value: "joined_at_desc", label: "Joined (newest)" },
  { value: "name_asc", label: "Name A→Z" },
  { value: "name_desc", label: "Name Z→A" },
  { value: "pulse_status", label: "Pulse (at-risk first)" },
  { value: "last_activity_desc", label: "Last activity (recent)" },
  { value: "last_activity_asc", label: "Last activity (stale)" },
  { value: "ai_level", label: "AI level" },
];

const PULSE_RANK: Record<RosterRow["pulse_status"], number> = {
  at_risk: 0,
  late: 1,
  pending: 2,
  current: 3,
};

const AI_RANK: Record<string, number> = {
  new: 0,
  consumer: 1,
  builder: 2,
  shipper: 3,
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
  const [filters, setFilters] = React.useState<RosterFilters>({});
  const [sort, setSort] = React.useState<RosterSort>("joined_at_asc");
  const [selected, setSelected] = React.useState<RosterRow | null>(null);
  const initialLoadedRef = React.useRef(false);

  // Load persisted state once on mount.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/moderator/ui-state")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.roster_filters && typeof data.roster_filters === "object") {
          setFilters(data.roster_filters as RosterFilters);
        }
        if (typeof data.roster_sort === "string") {
          setSort(data.roster_sort as RosterSort);
        }
      })
      .catch(() => {})
      .finally(() => {
        initialLoadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist filters whenever they change (skip the initial load round-trip).
  React.useEffect(() => {
    if (!initialLoadedRef.current) return;
    persistUiState({ roster_filters: filters as Record<string, unknown> });
  }, [filters]);

  React.useEffect(() => {
    if (!initialLoadedRef.current) return;
    persistUiState({ roster_sort: sort });
  }, [sort]);

  const showInactive = filters.show_inactive === true;
  const activeCount = members.filter((m) => !m.is_inactive).length;
  const inactiveCount = members.length - activeCount;

  const visible = React.useMemo(() => {
    let rows = members.slice();
    if (!showInactive) rows = rows.filter((r) => !r.is_inactive);
    if (filters.status && filters.status.length > 0) {
      const set = new Set(filters.status);
      rows = rows.filter((r) => set.has(r.pulse_status));
    }
    if (filters.ai_level && filters.ai_level.length > 0) {
      const set = new Set(filters.ai_level);
      rows = rows.filter((r) => set.has(r.ai_experience_level));
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.display_name.toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.availability_snippet ?? "").toLowerCase().includes(q)
      );
    }
    rows.sort(comparatorFor(sort));
    return rows;
  }, [members, filters, sort, showInactive]);

  const toggleStatus = (s: string) => {
    setFilters((f) => {
      const current = new Set(f.status ?? []);
      if (current.has(s)) current.delete(s);
      else current.add(s);
      return { ...f, status: Array.from(current) };
    });
  };
  const toggleAi = (s: string) => {
    setFilters((f) => {
      const current = new Set(f.ai_level ?? []);
      if (current.has(s)) current.delete(s);
      else current.add(s);
      return { ...f, ai_level: Array.from(current) };
    });
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Members</h2>
        <div className="flex items-center gap-3 text-xs text-cloud/60">
          <span>
            {activeCount} active
            {inactiveCount > 0 && ` · ${inactiveCount} inactive`}
          </span>
          {inactiveCount > 0 && (
            <button
              onClick={() =>
                setFilters((f) => ({ ...f, show_inactive: !showInactive }))
              }
              className="text-aqua transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
            >
              {showInactive ? "Hide inactive" : "Show inactive"}
            </button>
          )}
        </div>
      </div>

      <RosterControls
        filters={filters}
        sort={sort}
        onSearch={(v) => setFilters((f) => ({ ...f, search: v }))}
        onToggleStatus={toggleStatus}
        onToggleAi={toggleAi}
        onSort={setSort}
      />

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
                  <ManagedTooltip
                    tooltipKey={`pulse_status_${m.pulse_status}`}
                    content={pulseStatusTooltip(m.pulse_status)}
                  >
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PULSE_STATUS_COLOR[m.pulse_status]}`}
                    >
                      {PULSE_STATUS_LABEL[m.pulse_status]}
                    </span>
                  </ManagedTooltip>
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
                  No members match the current filter.
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

function RosterControls({
  filters,
  sort,
  onSearch,
  onToggleStatus,
  onToggleAi,
  onSort,
}: {
  filters: RosterFilters;
  sort: RosterSort;
  onSearch: (v: string) => void;
  onToggleStatus: (s: string) => void;
  onToggleAi: (s: string) => void;
  onSort: (s: RosterSort) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <input
        type="text"
        placeholder="Search by name, email, availability…"
        value={filters.search ?? ""}
        onChange={(e) => onSearch(e.target.value)}
        className="min-w-[220px] flex-1 rounded-md border border-whisper bg-white/[0.02] px-3 py-1.5 text-sm text-cloud placeholder:text-cloud/40 focus-visible:border-teal focus-visible:outline-none"
      />
      <FilterGroup
        label="Pulse"
        options={PULSE_STATUSES.map((v) => ({ value: v, label: v.replace("_", " ") }))}
        selected={filters.status ?? []}
        onToggle={onToggleStatus}
      />
      <FilterGroup
        label="AI"
        options={AI_LEVELS.map((v) => ({ value: v, label: v }))}
        selected={filters.ai_level ?? []}
        onToggle={onToggleAi}
      />
      <label className="inline-flex items-center gap-2 text-xs text-cloud/60">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as RosterSort)}
          className="rounded-md border border-whisper bg-white/[0.02] px-2 py-1 text-cloud focus-visible:border-teal focus-visible:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-midnight">
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-cloud/60">{label}:</span>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className={`rounded-full px-2 py-0.5 transition-colors ${
              on
                ? "bg-teal/25 text-aqua"
                : "bg-white/[0.04] text-cloud/60 hover:text-cloud"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function comparatorFor(sort: RosterSort) {
  return (a: RosterRow, b: RosterRow): number => {
    switch (sort) {
      case "joined_at_asc":
        return a.joined_at.localeCompare(b.joined_at);
      case "joined_at_desc":
        return b.joined_at.localeCompare(a.joined_at);
      case "name_asc":
        return a.display_name.localeCompare(b.display_name);
      case "name_desc":
        return b.display_name.localeCompare(a.display_name);
      case "pulse_status":
        return PULSE_RANK[a.pulse_status] - PULSE_RANK[b.pulse_status];
      case "last_activity_desc":
        return (b.last_activity_at ?? "").localeCompare(
          a.last_activity_at ?? ""
        );
      case "last_activity_asc":
        return (a.last_activity_at ?? "￿").localeCompare(
          b.last_activity_at ?? "￿"
        );
      case "ai_level":
        return (
          (AI_RANK[a.ai_experience_level] ?? 99) -
          (AI_RANK[b.ai_experience_level] ?? 99)
        );
      default:
        return 0;
    }
  };
}

function daysAgo(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function pulseStatusTooltip(status: RosterRow["pulse_status"]): string {
  switch (status) {
    case "current":
      return "Submitted the most recent pulse on time.";
    case "pending":
      return "Most recent pulse is still in its open window (≤7 days). Not late yet.";
    case "late":
      return "Most recent pulse missed and the window has closed.";
    case "at_risk":
      return "Missed the consecutive-pulse threshold. Surfaces in the at-risk nudge list.";
  }
}
