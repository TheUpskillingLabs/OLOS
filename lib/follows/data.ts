import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The follow graph (migration 00074). A member follows other members ("user"
 * targets) and org "pages" (sector / workstream / lab). These helpers centralize
 * the polymorphic target ↔ columns mapping so the API route, the feed filter,
 * and the follow buttons all agree.
 */

export type FollowType = "user" | "sector" | "workstream" | "lab";

export interface FollowTarget {
  type: FollowType;
  id: number;
}

/** A target → the follows row columns (user vs. page split). */
export function targetColumns(target: FollowTarget): {
  followee_participant_id: number | null;
  page_type: string | null;
  page_id: number | null;
} {
  if (target.type === "user") {
    return {
      followee_participant_id: target.id,
      page_type: null,
      page_id: null,
    };
  }
  return {
    followee_participant_id: null,
    page_type: target.type,
    page_id: target.id,
  };
}

/** The participant ids this viewer follows (the "Following" feed's author set). */
export async function getFollowedParticipantIds(
  service: SupabaseClient,
  viewerId: number
): Promise<number[]> {
  const { data, error } = await service
    .from("follows")
    .select("followee_participant_id")
    .eq("follower_participant_id", viewerId)
    .not("followee_participant_id", "is", null);
  if (error) {
    console.error("[follows] followed-ids query failed:", error.message);
    return [];
  }
  return (data ?? [])
    .map((r) => r.followee_participant_id as number | null)
    .filter((id): id is number => id != null);
}

/** Whether this viewer already follows the given target. */
export async function isFollowing(
  service: SupabaseClient,
  viewerId: number,
  target: FollowTarget
): Promise<boolean> {
  let query = service
    .from("follows")
    .select("id", { head: true, count: "exact" })
    .eq("follower_participant_id", viewerId);
  if (target.type === "user") {
    query = query.eq("followee_participant_id", target.id);
  } else {
    query = query.eq("page_type", target.type).eq("page_id", target.id);
  }
  const { count } = await query;
  return (count ?? 0) > 0;
}
