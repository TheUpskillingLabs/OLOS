// Owner lifecycle registry — the allowlist.
//
// The only per-entity, hand-maintained part of the feature. A verb is available
// for an entity ONLY if it is declared here, and the API route dispatches purely
// off this table (unknown key → 404, unsupported verb → 405). Adding an entity or
// enabling a verb is a deliberate edit here — nothing is reflected from the schema.
//
// Phase 1: participants only. cycles/pods/projects (Phase 2) and metros/content
// (Phase 3) get their entries added alongside their RPCs/helpers.

import type { LifecycleDescriptor, OwnerAction, OwnerEntityKey } from "./types";

export const OWNER_REGISTRY: Partial<Record<OwnerEntityKey, LifecycleDescriptor>> = {
  participants: {
    key: "participants",
    table: "participants",
    idColumn: "id",
    label: "User profile",
    labelField: "email",
    // Archive = deactivate: stamp archived_at + revoke roles/enrollments/memberships.
    // Multi-table, so a named TS helper (archive.ts) rather than a single column flip.
    archive: { kind: "helper", fn: "archiveParticipant" },
    // Reset = wipe journey, keep identity/authority (00079).
    reset: { kind: "rpc", fn: "reset_participant" },
    // Hard delete = GDPR erasure (00058, hardened in 00079).
    delete: { kind: "rpc", fn: "delete_participant" },
    guards: ["apexOwner", "self"],
  },

  // ── Phase 2: cycles / pods / projects (archive + reset; no hard delete — owner
  // decision: big entities are never row-deleted, only deactivated/reset). ──
  cycles: {
    key: "cycles",
    table: "cycles",
    idColumn: "id",
    label: "Cycle",
    labelField: "name",
    // Archive = status 'archived' + close-out (pods dissolved, projects graduate).
    archive: { kind: "helper", fn: "archiveCycle" },
    // Reset = wipe the cohort to a pristine draft + default config (00080).
    reset: { kind: "rpc", fn: "reset_cycle" },
    delete: null,
    guards: [],
  },

  pods: {
    key: "pods",
    table: "pods",
    idColumn: "id",
    label: "Pod",
    labelField: "name",
    archive: { kind: "helper", fn: "archivePod" }, // status 'dissolved' + close memberships
    reset: { kind: "rpc", fn: "reset_pod" }, // drop projects/solutions/members → 'forming'
    delete: null,
    guards: [],
  },

  projects: {
    key: "projects",
    table: "projects",
    idColumn: "id",
    label: "Project",
    labelField: "name",
    archive: { kind: "status", column: "status", archivedValue: "inactive" },
    reset: { kind: "rpc", fn: "reset_project" }, // drop members/roles → 'forming'
    delete: null,
    guards: [],
  },

  // ── Phase 3: metros + content (archive only). Surfaced via the generalized owner
  // console (lib/owner/flag.ts) and, for metros, the labs admin page. ──
  metros: {
    key: "metros",
    table: "metros",
    idColumn: "id",
    label: "Metro",
    labelField: "name",
    // metros.status is CHECK-locked to active/waitlist, so archive is a timestamp
    // flag (00081). The default metro is never archivable (defaultMetro guard).
    archive: { kind: "timestamp", column: "archived_at" },
    reset: null,
    delete: null,
    guards: ["defaultMetro"],
  },

  events: {
    key: "events",
    table: "events",
    idColumn: "id",
    label: "Event",
    labelField: "name",
    archive: { kind: "status", column: "status", archivedValue: "archived" },
    reset: null,
    delete: null,
    guards: [],
  },

  resources: {
    key: "resources",
    table: "resources",
    idColumn: "id",
    label: "Resource",
    labelField: "title",
    archive: { kind: "status", column: "status", archivedValue: "archived" },
    reset: null,
    delete: null,
    guards: [],
  },

  announcements: {
    key: "announcements",
    table: "announcements",
    idColumn: "id",
    label: "Announcement",
    labelField: "title",
    archive: { kind: "status", column: "status", archivedValue: "archived" },
    reset: null,
    delete: null,
    guards: [],
  },

  spotlights: {
    key: "spotlights",
    table: "spotlights",
    idColumn: "id",
    label: "Spotlight",
    labelField: "name",
    // spotlights.status CHECK is (submitted/published/hidden) — 'hidden' is its
    // soft-hide value (no 'archived'), so archive flips status → 'hidden'.
    archive: { kind: "status", column: "status", archivedValue: "hidden" },
    reset: null,
    delete: null,
    guards: [],
  },
};

/** Ordered list of entity keys currently wired for owner lifecycle actions. */
export const OWNER_ENTITY_KEYS = Object.keys(OWNER_REGISTRY) as OwnerEntityKey[];

/** Runtime guard: is an arbitrary (untrusted) URL string an allowlisted owner entity? */
export function isOwnerEntityKey(value: string | null | undefined): value is OwnerEntityKey {
  return value != null && Object.prototype.hasOwnProperty.call(OWNER_REGISTRY, value);
}

/** Look up a descriptor by (possibly untrusted) key; null when not allowlisted. */
export function getLifecycleDescriptor(
  key: string | null | undefined
): LifecycleDescriptor | null {
  return isOwnerEntityKey(key) ? OWNER_REGISTRY[key] ?? null : null;
}

/** The verbs a descriptor supports, in Archive → Reset → Delete order. */
export function supportedActions(d: LifecycleDescriptor): OwnerAction[] {
  const actions: OwnerAction[] = [];
  if (d.archive) actions.push("archive");
  if (d.reset) actions.push("reset");
  if (d.delete) actions.push("delete");
  return actions;
}
