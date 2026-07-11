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
