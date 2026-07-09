import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One-time seed: a member with an active local lab follows that lab page by
 * default (migration 00075). Runs on dashboard load; the `lab_follow_seeded`
 * flag makes it fire at most once, so a member who later unfollows their lab
 * is not re-subscribed. Best-effort — never throws into the render path.
 */
export async function ensureLabFollowSeeded(
  service: SupabaseClient,
  participant: {
    id: number;
    metro_id: number | null;
    lab_follow_seeded?: boolean | null;
  }
): Promise<void> {
  if (participant.metro_id == null || participant.lab_follow_seeded) return;
  try {
    // Idempotent against the partial unique index (a manual earlier follow just
    // no-ops on 23505); then flip the flag so this never runs again.
    const { error } = await service.from("follows").insert({
      follower_participant_id: participant.id,
      page_type: "lab",
      page_id: participant.metro_id,
    });
    if (error && error.code !== "23505") {
      console.error("[follows] lab seed insert failed:", error.message);
    }
    await service
      .from("participants")
      .update({ lab_follow_seeded: true })
      .eq("id", participant.id);
  } catch (e) {
    console.error("[follows] lab seed failed:", e);
  }
}
