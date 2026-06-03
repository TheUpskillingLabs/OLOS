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
  return [...cols];
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
  const sd = includeDeleted ? null : softDeleteFilter(config);
  if (sd) {
    // NOT-IN (status) keeps unknown future statuses visible rather than hidden.
    query = sd.kind === "isNull"
      ? query.is(sd.column, null)
      : query.not(sd.column, "in", sd.values);
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
): Promise<RelationResult> {
  const config = REGISTRY[rel.entity];

  let query = supabase
    .from(config.table)
    .select(buildSelectColumns(config).join(", "), { count: "exact" })
    .eq(rel.via, id)
    .order(config.defaultSort.column, {
      ascending: config.defaultSort.direction === "asc",
    })
    .range(0, RELATION_ROW_LIMIT - 1);

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
): Promise<FetchDetailResult> {
  const config = REGISTRY[entity];

  const { data, error } = await supabase
    .from(config.table)
    .select(buildSelectColumns(config).join(", "))
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;

  const row = (data ?? null) as unknown as EntityRow | null;
  if (!row) {
    return { config, row: null, foreignKeyLabels: {}, relations: [] };
  }

  const [foreignKeyLabels, relations] = await Promise.all([
    resolveForeignKeyLabels(supabase, config, [row]),
    Promise.all(config.relations.map((rel) => fetchRelation(supabase, rel, id))),
  ]);

  return { config, row, foreignKeyLabels, relations };
}
