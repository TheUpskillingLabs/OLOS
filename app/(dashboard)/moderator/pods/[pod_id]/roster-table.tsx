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

// The design system's .status grammar: colored dot + uppercase label,
// never a pill. Two-signal palette — teal=healthy, meta=quiet, red=risk
// (late and at-risk both read red; the label disambiguates).
const PULSE_STATUS_COLOR: Record<RosterRow["pulse_status"], string> = {
  current: "status active",
  pending: "status soon",
  late: "status risk",
  at_risk: "status risk",
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
  { value: "last_activity_desc", label: "Last activity (recent)" },
  { value: "last_activity_asc", label: "Last activity (stale)" },
  { value: "name_asc", label: "Name A→Z" },
  { value: "name_desc", label: "Name Z→A" },
  { value: "pulse_status", label: "Pulse (at-risk first)" },
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
  const [sort, setSort] = React.useState<RosterSort>("last_activity_desc");
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
  // Staff/test accounts hidden by default (memo ask / prototype
  // visibleMembers() rule) — a visibility toggle, never a permission.
  const showStaffTest = filters.show_staff_test === true;
  const staffTestCount = members.filter((m) => m.is_staff_or_test).length;
  const realMembers = members.filter((m) => !m.is_staff_or_test);
  const activeCount = realMembers.filter((m) => !m.is_inactive).length;
  const inactiveCount = realMembers.length - activeCount;
  const trendingCount = members.filter(
    (m) => m.is_trending_at_risk && !m.is_inactive
  ).length;

  const visible = React.useMemo(() => {
    let rows = members.slice();
    if (!showStaffTest) rows = rows.filter((r) => !r.is_staff_or_test);
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
  }, [members, filters, sort, showInactive, showStaffTest]);

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
        <h2 className="t-h3 text-ink">Members</h2>
        <div className="flex items-center gap-3 text-xs text-meta">
          <span>
            {activeCount} active
            {inactiveCount > 0 && ` · ${inactiveCount} inactive`}
          </span>
          {inactiveCount > 0 && (
            <button
              onClick={() =>
                setFilters((f) => ({ ...f, show_inactive: !showInactive }))
              }
              className="text-teal-deep transition-colors hover:text-ink focus-visible:outline-none focus-visible:underline"
            >
              {showInactive ? "Hide inactive" : "Show inactive"}
            </button>
          )}
          {staffTestCount > 0 && (
            <button
              onClick={() =>
                setFilters((f) => ({ ...f, show_staff_test: !showStaffTest }))
              }
              className="text-teal-deep transition-colors hover:text-ink focus-visible:outline-none focus-visible:underline"
            >
              {showStaffTest
                ? "Hide staff & test accounts"
                : "Show staff & test accounts"}
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

      {trendingCount > 0 && (
        <div className="mb-3 rounded-card border border-red/20 bg-red/[0.04] px-3 py-2 text-xs text-red">
          {trendingCount === 1
            ? "1 member trending — one miss from at-risk."
            : `${trendingCount} members trending — one miss from at-risk.`}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/[0.02]">
            <tr>
              <th className="lbl px-4 py-3">Member</th>
              <th className="lbl px-4 py-3">AI level</th>
              <th className="lbl px-4 py-3">Availability</th>
              <th className="lbl px-4 py-3">Pulse</th>
              <th className="lbl px-4 py-3">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr
                key={m.participant_id}
                onClick={() => setSelected(m)}
                className={`cursor-pointer border-t border-ink/10 transition-colors hover:bg-ink/[0.02] ${
                  m.is_inactive ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-teal text-xs font-semibold text-white">
                      {m.initials}
                    </div>
                    <div className="font-medium text-ink">{m.display_name}</div>
                    {m.is_inactive && (
                      <span className="rounded-sm bg-ink/[0.04] px-2 py-0.5 text-xs text-meta">
                        inactive
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate">
                  {AI_LEVEL_LABEL[m.ai_experience_level] ?? m.ai_experience_level}
                </td>
                <td className="px-4 py-3 text-slate">
                  {m.availability_snippet ?? (
                    <span className="text-meta-soft">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ManagedTooltip
                      tooltipKey={`pulse_status_${m.pulse_status}`}
                      content={pulseStatusTooltip(m.pulse_status)}
                    >
                      <span className={PULSE_STATUS_COLOR[m.pulse_status]}>
                        {PULSE_STATUS_LABEL[m.pulse_status]}
                      </span>
                    </ManagedTooltip>
                    {m.is_trending_at_risk && (
                      <ManagedTooltip
                        tooltipKey="trending_at_risk"
                        content="Trending toward at-risk: one more missed pulse and this member crosses the at-risk threshold."
                      >
                        <span className="inline-flex rounded-sm bg-red/10 px-2 py-0.5 text-xs font-medium text-red">
                          trending
                        </span>
                      </ManagedTooltip>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums text-slate">
                  <div className="flex items-center gap-2">
                    {m.last_activity_at ? (
                      <span>{daysAgo(m.last_activity_at)} days ago</span>
                    ) : (
                      <span className="text-meta-soft">no pulse yet</span>
                    )}
                    {m.streak >= 2 && (
                      <ManagedTooltip
                        tooltipKey="streak_badge"
                        content="Consecutive submitted pulses (looking back from the most recent scheduled date)."
                      >
                        <span
                          className="inline-flex items-center gap-0.5 rounded-sm bg-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-teal-deep"
                          title={`${m.streak}-pulse streak`}
                        >
                          🔥 {m.streak}
                        </span>
                      </ManagedTooltip>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr className="border-t border-ink/10">
                <td
                  className="px-4 py-6 text-center text-meta"
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
        className="min-w-[220px] flex-1 rounded-card border border-ink/10 bg-white px-3 py-1.5 text-base text-ink placeholder:text-meta-soft focus-visible:border-teal focus-visible:outline-none"
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
      <label className="inline-flex items-center gap-2 text-xs text-meta">
        <span>Sort</span>
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value as RosterSort)}
          className="rounded-card border border-ink/10 bg-white px-2 py-1 text-ink focus-visible:border-teal focus-visible:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-white">
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
      <span className="text-meta">{label}:</span>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className={`rounded-sm px-2 py-0.5 transition-colors ${
              on
                ? "bg-teal/10 text-teal-deep"
                : "bg-ink/[0.04] text-meta hover:text-ink"
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
