// Owner lifecycle — ARCHIVE helpers (soft, reversible deactivation).
//
// Archive is idempotent status/timestamp writes, so it lives in TS and runs on the
// service-role client — the same contract as closeOutCycle (lib/cycle/closeout.ts).
// (Reset/delete are destructive multi-table teardowns and live in SECURITY DEFINER
// RPCs instead — see supabase/migrations/00079.)
//
// Every write is filtered to rows not already in the target state, so re-archiving
// (or a retried request) is a no-op — the returned counts reflect only rows this
// call actually changed.

import type { SupabaseClient } from "@supabase/supabase-js";
import { closeOutCycle, type CloseOutResult } from "@/lib/cycle/closeout";

export interface ArchiveParticipantResult {
  archived: boolean; // did THIS call flip archived_at (vs. already archived)?
  rolesRevoked: number;
  enrollmentsRevoked: number;
  membershipsClosed: number;
  assignmentsRemoved: number;
}

/**
 * Deactivate a user profile: stamp `archived_at`, revoke every active authority
 * grant, revoke active cycle enrollments, and close active pod memberships /
 * moderator assignments. Reversible: clear `archived_at` to un-hide (roles must be
 * re-granted via the access console — archive does not preserve which were active).
 *
 * The caller (app/api/owner/participants/[id]/route.ts) must have already run the
 * apex-owner + self guards; this helper does not re-check them.
 */
export async function archiveParticipant(
  client: SupabaseClient,
  participantId: number
): Promise<ArchiveParticipantResult> {
  const now = new Date().toISOString();

  const { data: archivedRows } = await client
    .from("participants")
    .update({ archived_at: now })
    .eq("id", participantId)
    .is("archived_at", null)
    .select("id");

  const { data: revokedRoles } = await client
    .from("participant_roles")
    .update({ revoked_at: now })
    .eq("participant_id", participantId)
    .is("revoked_at", null)
    .select("participant_id");

  const { data: revokedEnrollments } = await client
    .from("cycle_enrollments")
    .update({ status: "revoked" })
    .eq("participant_id", participantId)
    .neq("status", "revoked")
    .select("id");

  const { data: closedMemberships } = await client
    .from("pod_memberships")
    .update({ inactive_at: now })
    .eq("participant_id", participantId)
    .is("inactive_at", null)
    .select("id");

  const { data: removedAssignments } = await client
    .from("moderator_assignments")
    .update({ removed_at: now })
    .eq("participant_id", participantId)
    .is("removed_at", null)
    .select("id");

  return {
    archived: (archivedRows?.length ?? 0) > 0,
    rolesRevoked: revokedRoles?.length ?? 0,
    enrollmentsRevoked: revokedEnrollments?.length ?? 0,
    membershipsClosed: closedMemberships?.length ?? 0,
    assignmentsRemoved: removedAssignments?.length ?? 0,
  };
}

export interface ArchiveCycleResult extends CloseOutResult {
  archived: boolean; // did THIS call flip cycles.status → 'archived'?
}

/**
 * Archive a cycle: flip its status to 'archived' and run the standard cycle
 * close-out (pods → dissolved, memberships/assignments closed, projects graduate
 * to their sector). Reversible governance flip — no rows are deleted. Delegates the
 * close-out to `closeOutCycle` (lib/cycle/closeout.ts) so the owner path and the
 * `/api/cycles/[cycle_id]/status` path stay identical. Idempotent.
 */
export async function archiveCycle(
  client: SupabaseClient,
  cycleId: number
): Promise<ArchiveCycleResult> {
  const { data: archivedRows } = await client
    .from("cycles")
    .update({ status: "archived" })
    .eq("id", cycleId)
    .neq("status", "archived")
    .select("id");

  const closeout = await closeOutCycle(client, cycleId);
  return { archived: (archivedRows?.length ?? 0) > 0, ...closeout };
}

export interface ArchivePodResult {
  archived: boolean; // did THIS call flip pods.status → 'dissolved'?
  membershipsClosed: number;
  assignmentsRemoved: number;
}

/**
 * Archive a pod: dissolve it and close its open memberships / moderator
 * assignments — the pod-scoped subset of `closeOutCycle`. Reversible; no rows are
 * deleted. Idempotent (every write filters to rows not already in the target state).
 */
export async function archivePod(
  client: SupabaseClient,
  podId: number
): Promise<ArchivePodResult> {
  const now = new Date().toISOString();

  const { data: dissolvedRows } = await client
    .from("pods")
    .update({ status: "dissolved" })
    .eq("id", podId)
    .neq("status", "dissolved")
    .select("id");

  const { data: closedMemberships } = await client
    .from("pod_memberships")
    .update({ inactive_at: now })
    .eq("pod_id", podId)
    .is("inactive_at", null)
    .select("id");

  const { data: removedAssignments } = await client
    .from("moderator_assignments")
    .update({ removed_at: now })
    .eq("pod_id", podId)
    .is("removed_at", null)
    .select("id");

  return {
    archived: (dissolvedRows?.length ?? 0) > 0,
    membershipsClosed: closedMemberships?.length ?? 0,
    assignmentsRemoved: removedAssignments?.length ?? 0,
  };
}
