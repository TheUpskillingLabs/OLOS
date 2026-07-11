"use client";

// Structural filters (DESIGN.md §11 "Data vs. filters"): entity selector, cycle
// filter (auto-applied to cycleScoped entities), and the show-deleted toggle.
// All state lives in the URL — changing any control navigates with new params and
// resets to page 1. Free-text search is v2 (rendered disabled to mark placement).

import { useRouter, useSearchParams } from "next/navigation";
import { REGISTRY } from "@/lib/entity-explorer/registry";
import type { EntityKey } from "@/lib/entity-explorer/types";

/** Entity dropdown groups. Covers every key in the registry so no registered
    entity is reachable only by typing the URL. */
const GROUPS: { label: string; keys: EntityKey[] }[] = [
  { label: "Core", keys: ["cycles", "participants", "cycle_enrollments"] },
  { label: "Pods", keys: ["problem_statements", "votes", "pods", "pod_memberships", "moderator_assignments"] },
  { label: "Projects", keys: ["solution_proposals", "project_votes", "projects", "project_memberships"] },
  { label: "Auth & engagement", keys: ["user_roles", "pulse_checks"] },
  { label: "Content & agreements", keys: ["events", "resources", "metros", "cycle_agreements"] },
];

export type CycleOption = { id: number; name: string };

export function EntityPicker({
  entity,
  cycles,
  cycleId,
  includeDeleted,
}: {
  entity: EntityKey;
  cycles: CycleOption[];
  cycleId: number | null;
  includeDeleted: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Apply param updates and always reset to page 1 (filters changed).
  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.set("page", "1");
    router.push(`/admin/explore?${params.toString()}`);
  };

  const selectClass =
    "rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink transition-colors duration-150 hover:border-teal/60 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";
  const labelClass = "lbl lbl-teal";

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4 rounded-card border border-ink/10 bg-white p-4 shadow-card">
      {/* Entity */}
      <div className="flex flex-col gap-1">
        <label htmlFor="ee-entity" className={labelClass}>Entity</label>
        <select
          id="ee-entity"
          value={entity}
          onChange={(e) => update({ entity: e.target.value })}
          className={selectClass}
        >
          {GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.keys.map((key) => (
                <option key={key} value={key}>{REGISTRY[key].label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Cycle */}
      <div className="flex flex-col gap-1">
        <label htmlFor="ee-cycle" className={labelClass}>Cycle</label>
        <select
          id="ee-cycle"
          value={cycleId ?? ""}
          onChange={(e) => update({ cycle: e.target.value || null })}
          className={selectClass}
        >
          <option value="">All cycles</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Show deleted */}
      <label className="flex items-center gap-2 pb-2 text-sm text-charcoal">
        <input
          type="checkbox"
          checked={includeDeleted}
          onChange={(e) => update({ deleted: e.target.checked ? "1" : null })}
          className="h-4 w-4 rounded border-ink/20 bg-white accent-teal"
        />
        Show deleted
      </label>

      {/* Search — v2, disabled, marks placement only (DESIGN.md §11). */}
      <div className="ml-auto flex flex-col gap-1 opacity-50">
        <label htmlFor="ee-search" className={labelClass}>
          Search rows <span className="text-meta">· v2</span>
        </label>
        <input
          id="ee-search"
          type="text"
          placeholder="filter any column…"
          disabled
          className="rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink placeholder:text-meta"
        />
      </div>
    </div>
  );
}
