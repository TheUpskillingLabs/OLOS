"use client";

// Structural filters (DESIGN.md §11 "Data vs. filters"): entity selector, cycle
// filter (auto-applied to cycleScoped entities), the show-deleted toggle, a
// free-text search across every textColumn, and a dynamic single-column
// filter. All state lives in the URL — changing any control navigates with
// new params and resets to page 1. Compact single-row layout: inline labels
// instead of stacked ones, to keep the bar from eating the page.

import { Search, SlidersHorizontal, RotateCcw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { REGISTRY } from "@/lib/entity-explorer/registry";
import type { EntityKey } from "@/lib/entity-explorer/types";

export type EntityGroup = { label: string; keys: EntityKey[] };

/** Admin entity dropdown groups. Covers every key in the registry so no
    registered entity is reachable only by typing the URL. */
const ADMIN_GROUPS: EntityGroup[] = [
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
  basePath = "/admin/explore",
  groups = ADMIN_GROUPS,
}: {
  entity: EntityKey;
  /** Null hides the cycle filter (the pod surface is already one cycle). */
  cycles: CycleOption[] | null;
  cycleId: number | null;
  includeDeleted: boolean;
  /** List-route prefix navigation pushes to; defaults to the admin surface. */
  basePath?: string;
  /** Dropdown contents; the pod surface passes its allowlisted subset. */
  groups?: EntityGroup[];
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
    router.push(`${basePath}?${params.toString()}`);
  };

  const selectClass =
    "rounded-card border border-ink/10 bg-white px-2 py-1.5 text-sm text-ink transition-colors duration-150 hover:border-teal/60 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";
  const labelClass = "lbl lbl-teal shrink-0";

  // Cycle only filters entities that carry a cycle_id (registry.ts
  // cycleScoped) — e.g. Participants, User roles, Events have none, so
  // selecting a cycle there would silently do nothing (fetch.ts only
  // applies `.eq("cycle_id", …)` when cycleScoped is true). Grey it out
  // rather than let it look active and lie.
  const entityCycleScoped = REGISTRY[entity].cycleScoped;

  // Search + dynamic filter read straight off the URL (client component) —
  // no extra props needed, since fetch.ts's own guards (textColumns / the
  // columns allowlist) are what actually make them safe server-side.
  const searchTerm = searchParams.get("q") ?? "";
  const filterColumn = searchParams.get("fcol") ?? "";
  const filterValue = searchParams.get("fval") ?? "";
  const entityTextColumns = REGISTRY[entity].textColumns;
  const searchable = entityTextColumns.length > 0;
  const filterColumnIsText = entityTextColumns.includes(filterColumn);

  const hasActiveFilters =
    cycleId != null || includeDeleted || filterColumn !== "" || searchTerm !== "";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-ink/10 bg-white p-3 shadow-card">
      {/* Entity */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="ee-entity" className={labelClass}>Entity</label>
        <select
          id="ee-entity"
          value={entity}
          onChange={(e) => {
            const nextEntity = e.target.value as EntityKey;
            const nextConfig = REGISTRY[nextEntity];
            update({
              entity: nextEntity,
              // Drop filters that would no longer apply to anything.
              ...(nextConfig.cycleScoped ? {} : { cycle: null }),
              ...(nextConfig.textColumns.length === 0 ? { q: null } : {}),
              ...(filterColumn && !nextConfig.columns.includes(filterColumn)
                ? { fcol: null, fval: null }
                : {}),
            });
          }}
          className={selectClass}
        >
          {groups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.keys.map((key) => (
                <option key={key} value={key}>{REGISTRY[key].label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Cycle — hidden on the pod surface (a pod lives in one cycle). */}
      {cycles != null && (
        <div className="flex items-center gap-1.5">
          <label htmlFor="ee-cycle" className={labelClass}>Cycle</label>
          <select
            id="ee-cycle"
            value={entityCycleScoped ? cycleId ?? "" : ""}
            onChange={(e) => update({ cycle: e.target.value || null })}
            className={selectClass}
            disabled={!entityCycleScoped}
          >
            <option value="">
              {entityCycleScoped ? "All cycles" : "Not cycle-scoped"}
            </option>
            {entityCycleScoped &&
              cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
          </select>
        </div>
      )}

      {/* Show deleted */}
      <label className="flex items-center gap-1.5 text-sm text-charcoal">
        <input
          type="checkbox"
          checked={includeDeleted}
          onChange={(e) => update({ deleted: e.target.checked ? "1" : null })}
          className="h-4 w-4 rounded border-ink/20 bg-white accent-teal"
        />
        Deleted
      </label>

      {/* Dynamic filter — any displayed column, exact-match for non-text
          columns (e.g. an id or a *_id FK), substring ILIKE for textColumns.
          One label for the whole group, not one per control. */}
      <form
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("fval");
          update({
            fval: typeof value === "string" && value.trim() !== "" ? value.trim() : null,
          });
        }}
      >
        <label htmlFor="ee-fcol" className={labelClass}>Filter</label>
        <select
          id="ee-fcol"
          value={filterColumn}
          onChange={(e) => update({ fcol: e.target.value || null, fval: null })}
          className={selectClass}
        >
          <option value="">column…</option>
          {REGISTRY[entity].columns.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          id="ee-fval"
          name="fval"
          type="text"
          defaultValue={filterValue}
          key={`${filterColumn}:${filterValue}`}
          placeholder={filterColumnIsText ? "contains…" : "exact number…"}
          disabled={filterColumn === ""}
          className={`${selectClass} w-24 disabled:opacity-50`}
        />
        <button
          type="submit"
          disabled={filterColumn === ""}
          aria-label="Apply filter"
          className="rounded-card border border-teal/40 p-1.5 text-teal-deep transition-colors hover:bg-teal/10 disabled:opacity-40"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </form>

      {/* Reset — clears every filter but keeps the current entity. Disabled
          state stays legible (text-meta-soft, like the pager buttons) rather
          than fading toward invisible. */}
      <button
        type="button"
        onClick={() => update({ cycle: null, deleted: null, fcol: null, fval: null, q: null })}
        disabled={!hasActiveFilters}
        className={`flex items-center gap-1.5 rounded-card border px-2.5 py-1.5 text-sm transition-colors ${
          hasActiveFilters
            ? "border-ink/10 text-slate hover:border-teal/60 hover:text-teal-deep"
            : "cursor-default border-ink/10 text-meta-soft"
        }`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>

      {/* Free-text search — OR'd ILIKE across every textColumn (registry.ts).
          Greyed out for entities with none (Votes, Pod memberships, …). */}
      <form
        className="ml-auto flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          update({ q: typeof value === "string" && value.trim() !== "" ? value.trim() : null });
        }}
      >
        <label htmlFor="ee-search" className={labelClass}>Search</label>
        <input
          id="ee-search"
          name="q"
          type="text"
          defaultValue={searchTerm}
          key={searchTerm}
          placeholder={searchable ? "search text columns…" : "no text columns"}
          disabled={!searchable}
          className={`${selectClass} disabled:opacity-50`}
        />
        <button
          type="submit"
          disabled={!searchable}
          aria-label="Search"
          className="rounded-card border border-teal/40 p-1.5 text-teal-deep transition-colors hover:bg-teal/10 disabled:opacity-40"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
