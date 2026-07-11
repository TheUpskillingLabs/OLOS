// Owner lifecycle registry — the allowlist.
//
// The only per-entity, hand-maintained part of the feature. A verb is available
// for an entity ONLY if it is declared here, and the API route dispatches purely
// off this table (unknown key → 404, unsupported verb → 405). Adding an entity or
// enabling a verb is a deliberate edit here — nothing is reflected from the schema.
//
// Phase 1: participants only. cycles/pods/projects (Phase 2) and metros/content
// (Phase 3) get their entries added alongside their RPCs/helpers.

import type { LifecycleDescriptor, OwnerEntityKey } from "./types";

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
