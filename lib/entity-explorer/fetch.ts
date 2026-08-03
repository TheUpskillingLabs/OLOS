// Entity Explorer — generic, registry-driven fetch.
//
// A config-driven generalization of what app/(dashboard)/admin/participants/page.tsx
// does by hand (DESIGN.md §5, §9): fetch a page of rows with the service-role
// client, then batch-resolve foreign-key labels and join them in memory. Raw
// supabase-js, no ORM.
//
// The query-building and join logic is split into small pure helpers
// (exported for unit testing) from the single impure entry point fetchEntityList.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PAGE_SIZE, REGISTRY } from "./registry";
import type {
  EntityConfig,
  EntityKey,
  EntityRow,
  FetchDetailResult,
  FetchListParams,
  FetchListResult,
  Relation,
  RelationResult,
} from "./types";

/** Max rows fetched per relation section in the detail view (DESIGN.md §6.1). */
export const RELATION_ROW_LIMIT = 50;

// ── Pure helpers ────────────────────────────────────────────────────────────

/** Inclusive supabase `.range()` bounds for a 1-based page. */
export function pageRange(
  page: number,
  pageSize: number,
): { from: number; to: number } {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/**
 * The explicit column list to SELECT: displayed columns plus the columns the
 * query needs even when not shown (id, FK columns, the soft-delete column, and
 * cycle_id for the cycle filter). Deduped and order-stable. Never `select *`.
 */
export function buildSelectColumns(config: EntityConfig): string[] {
  const cols = new Set<string>(["id", ...config.columns]);
  for (const fk of config.foreignKeys) cols.add(fk.column);
  if (config.softDelete) cols.add(config.softDelete.column);
  if (config.cycleScoped) cols.add("cycle_id");
  if (config.podScope?.kind === "column") cols.add(config.podScope.column);
  return [...cols];
}

/** Escapes ILIKE wildcard characters so a literal `%` or `_` in user input
    doesn't act as a pattern wildcard. */
function escapeIlikeWildcards(term: string): string {
  return term.replace(/[%_]/g, (c) => `\\${c}`);
}

/**
 * Builds the `.or()` filter expression for a free-text search across every
 * one of the entity's `textColumns` (registry.ts) — the explicit allowlist of
 * human text columns. Null when the term is empty/whitespace-only, or when
 * the entity declares no textColumns at all (the caller then short-circuits
 * to zero rows rather than silently ignoring the search — DESIGN.md §11).
 */
export function buildSearchOrExpr(config: EntityConfig, term: string): string | null {
  const trimmed = term.trim();
  if (trimmed === "" || config.textColumns.length === 0) return null;
  // PostgREST's `.or()` string uses `,` and `()` as its own syntax — escape
  // those plus the ILIKE wildcards so a raw search term is read literally.
  const escaped = escapeIlikeWildcards(trimmed).replace(/[,()]/g, (c) => `\\${c}`);
  return config.textColumns.map((c) => `${c}.ilike.%${escaped}%`).join(",");
}

/**
 * Whether `column` is safe to filter on for the dynamic single-column filter:
 * it must be one of the entity's own displayed `columns` (never an arbitrary
 * string from a query param) — the same explicit-allowlist rule as every
 * other part of this module (DESIGN.md §6).
 */
export function isFilterableColumn(config: EntityConfig, column: string): boolean {
  return config.columns.includes(column);
}

/** Distinct, non-null values of `column` across the page's rows. */
export function collectIds(
  rows: EntityRow[],
  column: string,
): (number | string)[] {
  const ids = new Set<number | string>();
  for (const row of rows) {
    const value = row[column];
    if (value != null) ids.add(value as number | string);
  }
  return [...ids];
}

/**
 * Build an `{ id -> label }` map from target rows. Falls back to `#<id>` when the
 * label column is null/empty so a reference never renders blank.
 */
export function buildLabelMap(
  targetRows: EntityRow[],
  labelField: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of targetRows) {
    const id = row.id;
    if (id == null) continue;
    const key = String(id);
    const raw = row[labelField];
    map[key] = raw == null || raw === "" ? `#${key}` : String(raw);
  }
  return map;
}

/**
 * The soft-delete filter to apply, as a description (pure & testable). The caller
 * applies it to a query builder. Null when the entity has no soft delete.
 */
export function softDeleteFilter(
  config: EntityConfig,
):
  | { kind: "isNull"; column: string }
  | { kind: "notIn"; column: string; values: string }
  | null {
  const rule = config.softDelete;
  if (!rule) return null;
  if (rule.kind === "timestamp") return { kind: "isNull", column: rule.column };
  return { kind: "notIn", column: rule.column, values: `(${rule.deletedValues.join(",")})` };
}

/**
 * Resolve the id allowlist for a `lookup` pod scope (types.ts): the values of
 * `via.select` on the via entity, filtered to the pod. Returns null for
 * self/column scopes (no pre-query needed). The via entity's soft-deleted rows
 * are always excluded — e.g. a member who left the pod (inactive membership)
 * drops out of the participants/pulse_checks scope.
 */
async function resolvePodLookupIds(
  supabase: SupabaseClient,
  config: EntityConfig,
  podId: number,
): Promise<(number | string)[] | null> {
  const scope = config.podScope;
  if (scope?.kind !== "lookup") return null;

  const via = REGISTRY[scope.via.entity];
  if (via.podScope?.kind !== "column") {
    // Registry invariant (types.ts): a lookup's via entity carries pod_id.
    throw new Error(
      `entity-explorer: lookup via ${via.key} requires a column pod scope`,
    );
  }

  let query = supabase
    .from(via.table)
    .select(scope.via.select)
    .eq(via.podScope.column, podId);
  const sd = softDeleteFilter(via);
  if (sd) {
    query = sd.kind === "isNull"
      ? query.is(sd.column, null)
      : query.not(sd.column, "in", sd.values);
  }

  const { data, error } = await query;
  if (error) throw error;

  const ids = new Set<number | string>();
  for (const row of (data ?? []) as unknown as EntityRow[]) {
    const value = row[scope.via.select];
    if (value != null) ids.add(value as number | string);
  }
  return [...ids];
}

/**
 * Apply a pod scope to a query builder. `lookupIds` must be pre-resolved (and
 * non-empty — the caller short-circuits an empty allowlist to zero rows rather
 * than issuing `.in()` with an empty list).
 */
function applyPodScope<Q extends { eq: (c: string, v: unknown) => Q; in: (c: string, v: unknown[]) => Q }>(
  query: Q,
  config: EntityConfig,
  podId: number,
  lookupIds: (number | string)[] | null,
): Q {
  const scope = config.podScope;
  if (!scope) {
    // Programmer error: routes must allowlist entities before fetching.
    throw new Error(`entity-explorer: ${config.key} has no pod scope`);
  }
  if (scope.kind === "self") return query.eq("id", podId);
  if (scope.kind === "column") return query.eq(scope.column, podId);
  return query.in(scope.column, lookupIds ?? []);
}

// ── Impure fetch ─────────────────────────────────────────────────────────────

/**
 * Resolve FK-label maps for every foreign key on the page, one batched `.in()`
 * query per FK column, run in parallel. Returns `{ fkColumn -> { id -> label } }`.
 */
async function resolveForeignKeyLabels(
  supabase: SupabaseClient,
  config: EntityConfig,
  rows: EntityRow[],
): Promise<Record<string, Record<string, string>>> {
  const entries = await Promise.all(
    config.foreignKeys.map(async (fk) => {
      const ids = collectIds(rows, fk.column);
      if (ids.length === 0) return [fk.column, {}] as const;

      const target = REGISTRY[fk.target];
      const { data, error } = await supabase
        .from(target.table)
        .select(`id, ${target.labelField}`)
        .in("id", ids);
      if (error) throw error;

      // supabase-js can't statically type a dynamic select string, so it widens
      // `data` to a ParserError shape — cast through unknown (the rows are plain).
      return [
        fk.column,
        buildLabelMap((data ?? []) as unknown as EntityRow[], target.labelField),
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Fetch one page of an entity: server-side pagination, optional cycle filter,
 * soft-delete filter, and batched FK-label resolution. The caller is responsible
 * for the admin guard — this trusts that it runs behind it (DESIGN.md §8).
 */
export async function fetchEntityList(
  supabase: SupabaseClient,
  params: FetchListParams,
): Promise<FetchListResult> {
  const config = REGISTRY[params.entity];
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const includeDeleted = params.includeDeleted ?? false;
  const { from, to } = pageRange(page, pageSize);

  // ── Pod scope (poderator surface only): forced server-side from the route
  // path and the moderator-assignment check — never a user-editable query
  // param. Guarded against entities with no podScope (Problem statements,
  // Votes, …) so a mismatched caller no-ops rather than throws. ──
  const podId = params.podId != null && config.podScope != null ? params.podId : null;
  let podLookupIds: (number | string)[] | null = null;
  if (podId != null) {
    podLookupIds = await resolvePodLookupIds(supabase, config, podId);
    if (podLookupIds != null && podLookupIds.length === 0) {
      // Empty allowlist (e.g. a pod with no members yet) → zero rows, no query.
      return { config, rows: [], page, pageSize, total: 0, foreignKeyLabels: {} };
    }
  }

  let query = supabase
    .from(config.table)
    .select(buildSelectColumns(config).join(", "), { count: "exact" })
    .order(config.defaultSort.column, {
      ascending: config.defaultSort.direction === "asc",
    })
    .range(from, to);

  if (config.cycleScoped && params.cycleId != null) {
    query = query.eq("cycle_id", params.cycleId);
  }
  if (podId != null) {
    query = applyPodScope(query, config, podId, podLookupIds);
  }
  const sd = includeDeleted ? null : softDeleteFilter(config);
  if (sd) {
    // NOT-IN (status) keeps unknown future statuses visible rather than hidden.
    query = sd.kind === "isNull"
      ? query.is(sd.column, null)
      : query.not(sd.column, "in", sd.values);
  }

  // ── Free-text search: OR'd ILIKE across every textColumn. ──
  if (params.search != null) {
    const orExpr = buildSearchOrExpr(config, params.search);
    if (orExpr != null) {
      query = query.or(orExpr);
    } else if (params.search.trim() !== "") {
      // Non-empty term, but this entity has no textColumns to match against
      // (Votes, Pod memberships, …) — it can never match, so say so instead
      // of silently showing every row.
      return { config, rows: [], page, pageSize, total: 0, foreignKeyLabels: {} };
    }
  }

  // ── Dynamic single-column filter. ──
  if (
    params.filterColumn != null &&
    params.filterValue != null &&
    params.filterValue.trim() !== "" &&
    isFilterableColumn(config, params.filterColumn)
  ) {
    const value = params.filterValue.trim();
    if (config.textColumns.includes(params.filterColumn)) {
      query = query.ilike(params.filterColumn, `%${escapeIlikeWildcards(value)}%`);
    } else {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        // Non-text column, non-numeric value — no row can ever match.
        return { config, rows: [], page, pageSize, total: 0, foreignKeyLabels: {} };
      }
      query = query.eq(params.filterColumn, num);
    }
  }

  const { data, count, error } = await query;
  if (error) throw error;

  // Dynamic select string → supabase-js infers a ParserError shape; cast through
  // unknown. The runtime value is a plain array of rows.
  const rows = (data ?? []) as unknown as EntityRow[];
  const foreignKeyLabels = await resolveForeignKeyLabels(supabase, config, rows);

  return { config, rows, page, pageSize, total: count ?? 0, foreignKeyLabels };
}

/** Fetch one reverse-relation section: rows that point back at `id` via `rel.via`. */
async function fetchRelation(
  supabase: SupabaseClient,
  rel: Relation,
  id: number | string,
  podId: number | null,
): Promise<RelationResult> {
  const config = REGISTRY[rel.entity];

  // Pod mode: the caller already dropped relations without a podScope; the
  // survivors are narrowed to the pod so a 360 never walks outside it.
  let podLookupIds: (number | string)[] | null = null;
  if (podId != null) {
    podLookupIds = await resolvePodLookupIds(supabase, config, podId);
    if (podLookupIds != null && podLookupIds.length === 0) {
      return { relation: rel, config, rows: [], total: 0, truncated: false, foreignKeyLabels: {} };
    }
  }

  let query = supabase
    .from(config.table)
    .select(buildSelectColumns(config).join(", "), { count: "exact" })
    .eq(rel.via, id)
    .order(config.defaultSort.column, {
      ascending: config.defaultSort.direction === "asc",
    })
    .range(0, RELATION_ROW_LIMIT - 1);

  if (podId != null) {
    query = applyPodScope(query, config, podId, podLookupIds);
  }

  // Relation sections always hide soft-deleted rows (DESIGN.md §6.1).
  const sd = softDeleteFilter(config);
  if (sd) {
    query = sd.kind === "isNull"
      ? query.is(sd.column, null)
      : query.not(sd.column, "in", sd.values);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as EntityRow[];
  const total = count ?? rows.length;
  const foreignKeyLabels = await resolveForeignKeyLabels(supabase, config, rows);

  return { relation: rel, config, rows, total, truncated: total > rows.length, foreignKeyLabels };
}

/**
 * Fetch a record's detail / 360 view: the base row plus every reverse relation
 * fetched in parallel and rendered as its own section (DESIGN.md §6.1). The caller
 * is responsible for the admin guard. Returns `row: null` when the id doesn't exist.
 */
export async function fetchEntityDetail(
  supabase: SupabaseClient,
  entity: EntityKey,
  id: number | string,
  podId: number | null = null,
): Promise<FetchDetailResult> {
  const config = REGISTRY[entity];

  // Pod mode: the base row itself must belong to the pod — a poderator typing
  // a foreign id into the URL gets a 404 (`row: null`), not another pod's data.
  let podLookupIds: (number | string)[] | null = null;
  if (podId != null) {
    podLookupIds = await resolvePodLookupIds(supabase, config, podId);
    if (podLookupIds != null && podLookupIds.length === 0) {
      return { config, row: null, foreignKeyLabels: {}, relations: [] };
    }
  }

  let baseQuery = supabase
    .from(config.table)
    .select(buildSelectColumns(config).join(", "))
    .eq("id", id);
  if (podId != null) {
    baseQuery = applyPodScope(baseQuery, config, podId, podLookupIds);
  }
  const { data, error } = await baseQuery.maybeSingle();
  if (error) throw error;

  const row = (data ?? null) as unknown as EntityRow | null;
  if (!row) {
    return { config, row: null, foreignKeyLabels: {}, relations: [] };
  }

  // Pod mode drops relations to entities with no pod scope (cycle_enrollments,
  // votes, user_roles, …) — a participant 360 shown to a poderator lists only
  // this pod's slice of that member's activity.
  const visibleRelations =
    podId == null
      ? config.relations
      : config.relations.filter((rel) => REGISTRY[rel.entity].podScope != null);

  const [foreignKeyLabels, relations] = await Promise.all([
    resolveForeignKeyLabels(supabase, config, [row]),
    Promise.all(visibleRelations.map((rel) => fetchRelation(supabase, rel, id, podId))),
  ]);

  return { config, row, foreignKeyLabels, relations };
}

// ── CSV export ───────────────────────────────────────────────────────────────

/** Hard cap on exported rows — keeps the export handlers memory-bounded. */
export const EXPORT_ROW_CAP = 10000;
const EXPORT_PAGE_SIZE = 1000;

/**
 * Fetch EVERY row matching the current filters (entity + cycle/pod + deleted
 * toggle) for the CSV download, by paging fetchEntityList to the cap. FK label
 * maps are merged across pages so the CSV can carry human-readable `_label`
 * columns next to raw ids. `truncated` flags a capped export so the routes can
 * say so instead of shipping a silently incomplete file.
 */
export async function fetchEntityRowsForExport(
  supabase: SupabaseClient,
  params: Omit<FetchListParams, "page" | "pageSize">,
): Promise<{
  config: EntityConfig;
  rows: EntityRow[];
  total: number;
  truncated: boolean;
  foreignKeyLabels: Record<string, Record<string, string>>;
}> {
  const config = REGISTRY[params.entity];
  const rows: EntityRow[] = [];
  const foreignKeyLabels: Record<string, Record<string, string>> = {};
  let total = 0;

  for (let page = 1; ; page += 1) {
    const result = await fetchEntityList(supabase, {
      ...params,
      page,
      pageSize: EXPORT_PAGE_SIZE,
    });
    rows.push(...result.rows);
    total = result.total;
    for (const [column, labels] of Object.entries(result.foreignKeyLabels)) {
      foreignKeyLabels[column] = { ...foreignKeyLabels[column], ...labels };
    }
    if (result.rows.length === 0 || rows.length >= total || rows.length >= EXPORT_ROW_CAP) {
      break;
    }
  }

  const capped = rows.slice(0, EXPORT_ROW_CAP);
  return {
    config,
    rows: capped,
    total,
    truncated: total > capped.length,
    foreignKeyLabels,
  };
}
