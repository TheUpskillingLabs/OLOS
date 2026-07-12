// Owner lifecycle management — the type surface.
//
// This module is the owner-only "delete / archive / reset any entity" feature.
// It is a STANDALONE allowlist, deliberately independent of lib/entity-explorer/
// (which is read-only and flag-off by default): a destructive-write feature must
// not silently disappear when the explorer flag is unset, and the explorer's
// "trivial to delete later" self-containment contract must stay intact.
//
// Every entity that supports an owner lifecycle action is listed by hand in
// registry.ts, and each entry declares WHICH of {archive, reset, delete} it
// supports and HOW. Phase 1 ships `participants` only; cycles/pods/projects
// (Phase 2) and metros/content (Phase 3) are added the same way.

export type OwnerEntityKey =
  | "participants"
  | "cycles"
  | "pods"
  | "projects"
  | "metros"
  | "events"
  | "resources"
  | "announcements"
  | "spotlights";

/** The three owner verbs. */
export type OwnerAction = "archive" | "reset" | "delete";

/**
 * How an entity's ARCHIVE (soft, reversible) is implemented:
 *  - status:    flip a status column to an archived value (e.g. projects → 'inactive')
 *  - timestamp: stamp a nullable timestamp column (e.g. metros.archived_at)
 *  - helper:    a named exported TS helper in archive.ts (multi-table deactivation,
 *               e.g. archiveParticipant / archiveCycle)
 */
export type ArchiveSpec =
  | { kind: "status"; column: string; archivedValue: string }
  | { kind: "timestamp"; column: string }
  | { kind: "helper"; fn: string };

/** Reset (wipe dependents + re-seed defaults) is always a SECURITY DEFINER RPC. */
export type ResetSpec = { kind: "rpc"; fn: string };

/** Hard delete is a SECURITY DEFINER RPC (participants only). */
export type DeleteSpec = { kind: "rpc"; fn: string };

/** Guardrails enforced in the API layer (the DB RPCs re-check independently). */
export type GuardKey = "apexOwner" | "self" | "activeCycle" | "defaultMetro";

export interface LifecycleDescriptor {
  key: OwnerEntityKey;
  table: string;
  idColumn: string;
  /** Human label for the entity, singular (e.g. "User profile", "Cycle"). */
  label: string;
  /** Column shown as the entity's name in the confirm dialog / audit log. */
  labelField: string;
  archive: ArchiveSpec | null;
  reset: ResetSpec | null;
  delete: DeleteSpec | null;
  guards: GuardKey[];
}
