// Entity Explorer — the registry (the allowlist).
//
// This is the only non-generic part of the explorer (DESIGN.md §6). Every entity,
// every displayed column, every FK target, and every reverse relation is listed by
// hand. We never reflect the schema, so a future migration cannot silently surface
// a new table or a sensitive column in the UI — a new entry has to be added here.
//
// Columns were verified against supabase/migrations/00001_initial_schema.sql plus
// later additive migrations (00007, 00018, 00011) — NOT against the mockup, whose
// column lists contain a few illustrative/fictional names. Deviations from the
// mockup and from DESIGN.md §6 are flagged inline with `NOTE:`.

import type { EntityConfig, EntityKey } from "./types";

/** Server-side page size. Pagination is in from day one (DESIGN.md §11). */
export const DEFAULT_PAGE_SIZE = 50;

export const REGISTRY: Record<EntityKey, EntityConfig> = {
  cycles: {
    key: "cycles",
    label: "Cycles",
    table: "cycles",
    columns: ["id", "name", "slug", "status", "start_date", "end_date"],
    labelField: "name",
    cycleScoped: false,
    softDelete: null,
    foreignKeys: [],
    defaultSort: { column: "id", direction: "desc" },
    relations: [],
  },

  participants: {
    key: "participants",
    label: "Participants",
    table: "participants",
    // NOTE: the participants table has ~40 columns, many sensitive (phone_number,
    // dcpl_card, gender, neighborhood, linkedin, notes, …). We deliberately
    // allowlist only the five the mockup shows. PII that IS shown (email,
    // google_id) is intentional — organizers = admins already see it (DESIGN.md §6).
    columns: ["id", "preferred_name", "email", "google_id", "created_at"],
    labelField: "preferred_name",
    cycleScoped: false,
    softDelete: null,
    foreignKeys: [],
    defaultSort: { column: "created_at", direction: "desc" },
    // Reverse relations for the participant 360 (DESIGN.md §6.1).
    relations: [
      { entity: "user_roles", via: "participant_id", label: "Roles" },
      { entity: "cycle_enrollments", via: "participant_id", label: "Cycle enrollments" },
      { entity: "pod_memberships", via: "participant_id", label: "Pod memberships" },
      { entity: "moderator_assignments", via: "participant_id", label: "Moderator assignments" },
      { entity: "problem_statements", via: "participant_id", label: "Problem statements" },
      { entity: "votes", via: "voter_id", label: "Votes cast" },
      { entity: "solution_proposals", via: "participant_id", label: "Solution proposals" },
      { entity: "project_votes", via: "voter_id", label: "Project votes" },
      { entity: "project_memberships", via: "participant_id", label: "Project memberships" },
      { entity: "pulse_checks", via: "participant_id", label: "Pulse checks" },
    ],
  },

  cycle_enrollments: {
    key: "cycle_enrollments",
    label: "Cycle enrollments",
    table: "cycle_enrollments",
    columns: ["id", "participant_id", "cycle_id", "status", "enrolled_at"],
    labelField: "id",
    cycleScoped: true,
    // NOTE: soft delete here is the `status` flag, not a NULL-able timestamp.
    // 'revoked' is treated as deleted (hidden by default, shown via the toggle);
    // 'active' and 'inactive' stay visible — 'inactive' is the column default for
    // a not-yet-activated enrollment, not a deletion.
    softDelete: { kind: "status", column: "status", deletedValues: ["revoked"] },
    foreignKeys: [
      { column: "participant_id", target: "participants" },
      { column: "cycle_id", target: "cycles" },
    ],
    defaultSort: { column: "enrolled_at", direction: "desc" },
    relations: [],
  },

  problem_statements: {
    key: "problem_statements",
    label: "Problem statements",
    table: "problem_statements",
    // NOTE: mockup showed `name` and `votes` columns — neither exists. The real
    // text column is `statement_text`; vote totals live in the `votes` table.
    columns: ["id", "statement_text", "participant_id", "cycle_id", "created_at"],
    labelField: "statement_text",
    cycleScoped: true,
    softDelete: null,
    foreignKeys: [
      { column: "participant_id", target: "participants" },
      { column: "cycle_id", target: "cycles" },
    ],
    defaultSort: { column: "created_at", direction: "desc" },
    relations: [],
  },

  votes: {
    key: "votes",
    label: "Votes",
    table: "votes",
    columns: ["id", "voter_id", "problem_statement_id", "vote_count", "created_at"],
    labelField: "id",
    cycleScoped: true,
    softDelete: null,
    foreignKeys: [
      { column: "voter_id", target: "participants" },
      { column: "problem_statement_id", target: "problem_statements" },
      { column: "cycle_id", target: "cycles" },
    ],
    defaultSort: { column: "created_at", direction: "desc" },
    relations: [],
  },

  pods: {
    key: "pods",
    label: "Pods",
    table: "pods",
    // NOTE: mockup showed a `members` column — that's a computed count, not a
    // stored column, so it's omitted.
    columns: ["id", "name", "status", "cycle_id", "created_at"],
    labelField: "name",
    cycleScoped: true,
    softDelete: null,
    foreignKeys: [{ column: "cycle_id", target: "cycles" }],
    defaultSort: { column: "created_at", direction: "desc" },
    // Reverse relations for the pod 360 (DESIGN.md §6.1 — "for free").
    relations: [
      { entity: "pod_memberships", via: "pod_id", label: "Pod memberships" },
      { entity: "moderator_assignments", via: "pod_id", label: "Moderator assignments" },
      { entity: "solution_proposals", via: "pod_id", label: "Solution proposals" },
      { entity: "project_votes", via: "pod_id", label: "Project votes" },
      { entity: "projects", via: "pod_id", label: "Projects" },
    ],
  },

  pod_memberships: {
    key: "pod_memberships",
    label: "Pod memberships",
    table: "pod_memberships",
    // NOTE: mockup + DESIGN.md §6 call the soft-delete column `left_at`; the real
    // column is `inactive_at` (migration 00001). Corrected here.
    columns: ["id", "participant_id", "pod_id", "joined_at", "inactive_at"],
    labelField: "id",
    cycleScoped: false,
    softDelete: { kind: "timestamp", column: "inactive_at" },
    foreignKeys: [
      { column: "participant_id", target: "participants" },
      { column: "pod_id", target: "pods" },
    ],
    defaultSort: { column: "joined_at", direction: "desc" },
    relations: [],
  },

  moderator_assignments: {
    key: "moderator_assignments",
    label: "Moderator assignments",
    table: "moderator_assignments",
    columns: ["id", "participant_id", "pod_id", "cycle_id", "assigned_at", "removed_at"],
    labelField: "id",
    cycleScoped: true,
    softDelete: { kind: "timestamp", column: "removed_at" },
    foreignKeys: [
      { column: "participant_id", target: "participants" },
      { column: "pod_id", target: "pods" },
      { column: "cycle_id", target: "cycles" },
    ],
    defaultSort: { column: "assigned_at", direction: "desc" },
    relations: [],
  },

  solution_proposals: {
    key: "solution_proposals",
    label: "Solution proposals",
    table: "solution_proposals",
    // `name` + `proposal_data` were added by migration 00018; `proposal_text`
    // (a large text body) is deliberately omitted from the list view.
    columns: ["id", "name", "pod_id", "participant_id", "proposal_data", "created_at"],
    labelField: "name",
    cycleScoped: true,
    softDelete: null,
    foreignKeys: [
      { column: "cycle_id", target: "cycles" },
      { column: "pod_id", target: "pods" },
      { column: "participant_id", target: "participants" },
    ],
    defaultSort: { column: "created_at", direction: "desc" },
    relations: [],
  },

  project_votes: {
    key: "project_votes",
    label: "Project votes",
    table: "project_votes",
    columns: ["id", "voter_id", "solution_proposal_id", "vote_count", "created_at"],
    labelField: "id",
    cycleScoped: true,
    softDelete: null,
    foreignKeys: [
      { column: "voter_id", target: "participants" },
      { column: "solution_proposal_id", target: "solution_proposals" },
      { column: "cycle_id", target: "cycles" },
    ],
    defaultSort: { column: "created_at", direction: "desc" },
    relations: [],
  },

  projects: {
    key: "projects",
    label: "Projects",
    table: "projects",
    columns: ["id", "name", "pod_id", "solution_proposal_id", "status", "cycle_id", "created_at"],
    labelField: "name",
    cycleScoped: true,
    softDelete: null,
    foreignKeys: [
      { column: "cycle_id", target: "cycles" },
      { column: "pod_id", target: "pods" },
      { column: "solution_proposal_id", target: "solution_proposals" },
    ],
    defaultSort: { column: "created_at", direction: "desc" },
    // Reverse relations for the project 360 (DESIGN.md §6.1 — "for free").
    relations: [
      { entity: "project_memberships", via: "project_id", label: "Project memberships" },
    ],
  },

  project_memberships: {
    key: "project_memberships",
    label: "Project memberships",
    table: "project_memberships",
    // NOTE: mockup showed `joined_at`; the real column is `registered_at`.
    columns: ["id", "participant_id", "project_id", "registered_at"],
    labelField: "id",
    // NOTE: DESIGN.md §6 marks this not-cycle-scoped with no soft delete, but the
    // table DOES have `cycle_id` and `left_at` (migration 00001). Both are honored
    // here so the cycle filter and show-deleted toggle work as elsewhere.
    cycleScoped: true,
    softDelete: { kind: "timestamp", column: "left_at" },
    foreignKeys: [
      { column: "participant_id", target: "participants" },
      { column: "project_id", target: "projects" },
    ],
    defaultSort: { column: "registered_at", direction: "desc" },
    relations: [],
  },

  user_roles: {
    key: "user_roles",
    label: "User roles",
    table: "user_roles",
    columns: ["id", "participant_id", "role", "granted_at", "revoked_at"],
    labelField: "role",
    cycleScoped: false,
    softDelete: { kind: "timestamp", column: "revoked_at" },
    foreignKeys: [{ column: "participant_id", target: "participants" }],
    defaultSort: { column: "granted_at", direction: "desc" },
    relations: [],
  },

  pulse_checks: {
    key: "pulse_checks",
    label: "Pulse checks",
    table: "pulse_checks",
    // NOTE: mockup showed `week` and `responses`; neither exists. The real
    // columns are `scheduled_date`, `completed_at`, and `survey_responses` (JSONB).
    columns: ["id", "participant_id", "cycle_id", "scheduled_date", "survey_responses", "created_at"],
    labelField: "id",
    // NOTE: pulse_checks.cycle_id was made nullable (migration 00004). The cycle
    // filter (.eq) will therefore exclude rows with a null cycle_id when a cycle
    // is selected; "All cycles" shows them.
    cycleScoped: true,
    softDelete: null,
    foreignKeys: [
      { column: "participant_id", target: "participants" },
      { column: "cycle_id", target: "cycles" },
    ],
    defaultSort: { column: "created_at", direction: "desc" },
    relations: [],
  },

  // Public-content + agreement tables (audit roadmap Phase 0: the explorer is
  // the read-only transparency stopgap for content and signature records —
  // Pod Squad memo "direct database access if dashboard features lag").
  events: {
    key: "events",
    label: "Events",
    table: "events",
    columns: ["id", "slug", "name", "kind", "anchor", "start_at", "status", "synced_at"],
    labelField: "name",
    cycleScoped: false,
    softDelete: { kind: "status", column: "status", deletedValues: ["archived"] },
    foreignKeys: [],
    defaultSort: { column: "start_at", direction: "desc" },
    relations: [],
  },

  resources: {
    key: "resources",
    label: "Library resources",
    table: "resources",
    columns: ["id", "slug", "title", "content_type", "author", "from_line", "status", "created_at"],
    labelField: "title",
    cycleScoped: false,
    softDelete: { kind: "status", column: "status", deletedValues: ["archived"] },
    foreignKeys: [],
    defaultSort: { column: "created_at", direction: "desc" },
    relations: [],
  },

  metros: {
    key: "metros",
    label: "Metros (local labs)",
    table: "metros",
    columns: ["id", "slug", "name", "st", "status", "partner", "members", "waiting_baseline"],
    labelField: "name",
    cycleScoped: false,
    softDelete: null,
    foreignKeys: [],
    defaultSort: { column: "id", direction: "asc" },
    relations: [],
  },

  cycle_agreements: {
    key: "cycle_agreements",
    label: "Cycle agreements",
    table: "cycle_agreements",
    // Insert-only signature records (migration 00032). The answers JSONB is
    // deliberately NOT listed — registration intake stays out of the grid.
    columns: ["id", "participant_id", "cycle_id", "agreement_version", "signature_name", "signed_at"],
    labelField: "id",
    cycleScoped: true,
    softDelete: null,
    foreignKeys: [
      { column: "participant_id", target: "participants" },
      { column: "cycle_id", target: "cycles" },
    ],
    defaultSort: { column: "signed_at", direction: "desc" },
    relations: [],
  },
};

/** Ordered list of entity keys, for building the entity picker. */
export const ENTITY_KEYS = Object.keys(REGISTRY) as EntityKey[];

/** Runtime guard: is an arbitrary URL string an allowlisted entity key? */
export function isEntityKey(value: string | null | undefined): value is EntityKey {
  return value != null && Object.prototype.hasOwnProperty.call(REGISTRY, value);
}

/** Look up a config by (possibly untrusted) key; null when not allowlisted. */
export function getEntityConfig(key: string | null | undefined): EntityConfig | null {
  return isEntityKey(key) ? REGISTRY[key] : null;
}
