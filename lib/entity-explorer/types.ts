// Entity Explorer — module-internal types.
//
// Read-only entity browser (stopgap). See docs/entity-explorer/DESIGN.md.
// Two surfaces share this module: the admin explorer (app/(dashboard)/admin/
// explore/) and the pod-scoped poderator explorer (app/(dashboard)/moderator/
// pods/[pod_id]/explore/ + the explore export API routes). Nothing else should
// import from it — keeping it self-contained is what makes the feature trivial
// to delete later (DESIGN.md §4).

/**
 * The closed set of entities the explorer can show. This union IS the allowlist:
 * adding an entity means adding a key here and a matching REGISTRY entry. A new
 * database table can never appear in the UI until someone edits this file
 * (DESIGN.md §6.1 — "explicit allowlist, not schema reflection").
 */
export type EntityKey =
  | "cycles"
  | "participants"
  | "cycle_enrollments"
  | "problem_statements"
  | "votes"
  | "pods"
  | "pod_memberships"
  | "moderator_assignments"
  | "solution_proposals"
  | "project_votes"
  | "projects"
  | "project_memberships"
  | "user_roles"
  | "pulse_checks"
  | "events"
  | "resources"
  | "metros"
  | "cycle_agreements";

export type SortDirection = "asc" | "desc";

/**
 * How an entity expresses "soft delete", so the show-deleted toggle can hide
 * those rows by default and reveal them on demand (DESIGN.md §9.3):
 *  - `timestamp`: deleted when `column` IS NOT NULL (e.g. removed_at, left_at).
 *  - `status`: deleted when `column` is one of `deletedValues` (e.g.
 *    cycle_enrollments.status = 'revoked'). NOT-IN, so unknown future statuses
 *    stay visible rather than being silently hidden.
 */
export type SoftDeleteRule =
  | { kind: "timestamp"; column: string }
  | { kind: "status"; column: string; deletedValues: string[] };

/**
 * How an entity's rows narrow to a single pod, for the pod-scoped poderator
 * surface (/moderator/pods/[pod_id]/explore). The moderator allowlist IS
 * "podScope declared": entities without one never render there.
 *  - `self`: the pods table itself — the row whose id IS the pod.
 *  - `column`: the table carries the pod's id directly (`.eq(column, podId)`).
 *  - `lookup`: no direct pod column; the allowed values of `column` are read
 *    first from another pod-scoped entity (e.g. participants via
 *    pod_memberships.participant_id; project_memberships via projects.id).
 *    The via entity must itself have a `column` pod scope.
 */
export type PodScope =
  | { kind: "self" }
  | { kind: "column"; column: string }
  | { kind: "lookup"; column: string; via: { entity: EntityKey; select: string } };

/** A forward foreign key: a column on this entity that points at another entity. */
export interface ForeignKey {
  /** Column on this entity holding the referenced row's id. */
  column: string;
  /** Registry key of the entity it points to. */
  target: EntityKey;
}

/**
 * A reverse relation: another entity whose rows point back at this one, used to
 * assemble the detail / 360 view (DESIGN.md §6.1).
 */
export interface Relation {
  /** Registry key of the entity that references this one. */
  entity: EntityKey;
  /** Column on that entity holding this entity's id. */
  via: string;
  /** Section heading in the 360 view. */
  label: string;
}

/** How to display one entity. The only non-generic part of the explorer. */
export interface EntityConfig {
  /** URL slug, e.g. "pods". Matches the EntityKey. */
  key: EntityKey;
  /** UI display name, e.g. "Pods". */
  label: string;
  /** Supabase table name. */
  table: string;
  /** Ordered, explicit allowlist of columns to display. Never `select *`. */
  columns: string[];
  /** Column that best represents a row when it's referenced as a FK elsewhere. */
  labelField: string;
  /** Explicit allowlist (subset of `columns`) of human-text columns free-text
      search and the ILIKE branch of the dynamic column filter may match
      against. Never derived from the schema — a VARCHAR/TEXT column doesn't
      make this list until someone decides it's meant to be searched (same
      allowlist discipline as `columns` itself). Empty for entities with no
      free-text column (Votes, Pod memberships, Moderator assignments, …). */
  textColumns: string[];
  /** True when the table has a `cycle_id` the global cycle filter applies to. */
  cycleScoped: boolean;
  /** How rows narrow to one pod; null = invisible on the poderator surface. */
  podScope: PodScope | null;
  /** How this entity soft-deletes rows, or null when it has no soft delete. */
  softDelete: SoftDeleteRule | null;
  /** Forward FK click-through map. */
  foreignKeys: ForeignKey[];
  /** Initial sort for the list view. `column` must appear in `columns`. */
  defaultSort: { column: string; direction: SortDirection };
  /** Reverse relations for the detail / 360 view (DESIGN.md §6.1). */
  relations: Relation[];
}

/** A raw row as returned by supabase-js; values are untyped by design. */
export type EntityRow = Record<string, unknown>;

/** Parameters for a paginated list fetch. */
export interface FetchListParams {
  entity: EntityKey;
  /** Applied as `.eq("cycle_id", …)` only when the entity is cycleScoped. */
  cycleId?: number | null;
  /** 1-based page number. */
  page?: number;
  /** Rows per page. Defaults to DEFAULT_PAGE_SIZE. */
  pageSize?: number;
  /** When false (default), soft-deleted rows are hidden. */
  includeDeleted?: boolean;
  /**
   * Forces pod scoping (poderator surface only). Server-derived from the
   * route path and the moderator-assignment check — never a user-editable
   * query param. Ignored (fetch.ts) when the entity has no podScope, rather
   * than throwing — a mismatched caller is a no-op, not an error.
   */
  podId?: number | null;
  /**
   * Free-text search: a case-insensitive substring match OR'd across every
   * one of the entity's `textColumns`. An entity with none (e.g. Votes)
   * returns zero rows for a non-empty term rather than silently matching
   * everything — a search box that looks active should never be a no-op.
   */
  search?: string | null;
  /**
   * Dynamic single-column filter: `filterColumn` must be one of the entity's
   * displayed `columns` (validated in fetch.ts — anything else is ignored,
   * not thrown, since it can arrive as a raw query param). ILIKE substring
   * match when the column is a `textColumn`; otherwise an exact numeric
   * `.eq()`, and a non-numeric value against a non-text column returns zero
   * rows (it can never match).
   */
  filterColumn?: string | null;
  filterValue?: string | null;
}

/**
 * Result of a list fetch. `foreignKeyLabels` maps an FK column on this entity to
 * a `{ id -> display label }` map for the referenced rows present on this page,
 * so the renderer can show a label instead of a bare id.
 */
export interface FetchListResult {
  config: EntityConfig;
  rows: EntityRow[];
  page: number;
  pageSize: number;
  total: number;
  foreignKeyLabels: Record<string, Record<string, string>>;
}

/** One reverse-relation section of a detail / 360 view (DESIGN.md §6.1). */
export interface RelationResult {
  relation: Relation;
  /** Config of the related (referencing) entity. */
  config: EntityConfig;
  rows: EntityRow[];
  /** Total matching rows; may exceed `rows.length` when capped. */
  total: number;
  /** True when more rows exist than were fetched. */
  truncated: boolean;
  foreignKeyLabels: Record<string, Record<string, string>>;
}

/** Result of a detail / 360 fetch: the base row plus every reverse relation. */
export interface FetchDetailResult {
  config: EntityConfig;
  /** The base row, or null when no row has that id. */
  row: EntityRow | null;
  /** FK labels for the base row's own forward foreign keys. */
  foreignKeyLabels: Record<string, Record<string, string>>;
  relations: RelationResult[];
}
