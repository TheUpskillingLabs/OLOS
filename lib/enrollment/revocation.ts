import { createServiceClient } from "@/lib/supabase/server";

/**
 * True if the participant's access for this cycle is currently revoked.
 *
 * The revocation flow marks cycle_enrollments 'inactive' (never 'revoked')
 * and records the event in access_revocations; reactivation restores the
 * enrollment to 'active' and appends an access_revocations row with
 * reason='reactivated'. "Currently revoked" therefore means: the latest
 * access_revocations row for (participant, cycle) exists and is not a
 * reactivation marker.
 *
 * Used by the phase-1/2 gates (problem statements, voting), which accept
 * enrolled-but-'inactive' participants (see isEnrolledParticipant) and must
 * not accept revoked ones — both states share enrollment status 'inactive'.
 *
 * Service client: access_revocations is admin-scoped under RLS, so a
 * cookie-bound user client would silently read zero rows and let a revoked
 * participant through.
 */
export async function isCurrentlyRevoked(
  participantId: number,
  cycleId: number
): Promise<boolean> {
  const serviceClient = createServiceClient();
  const { data: latest } = await serviceClient
    .from("access_revocations")
    .select("reason")
    .eq("participant_id", participantId)
    .eq("cycle_id", cycleId)
    .order("revoked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return !!latest && latest.reason !== "reactivated";
}
