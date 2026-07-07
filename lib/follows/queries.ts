import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityType } from "@/lib/validations/showcase";

/**
 * Read helpers for the follow graph (migration 00061).
 *
 * CRITICAL: `follows` has self-scoped RLS (a member sees only their own rows via
 * current_participant_id()). So every AGGREGATE read — a follower count, a
 * follower list, another member's following count — MUST use the SERVICE client,
 * which bypasses RLS. Passing an RLS-scoped client to these returns only the
 * caller's own row (0/1), silently wrong. Only getFollowedTargetKeys reads the
 * viewer's OWN set, so it's safe with either client. The `service` parameter
 * name is a reminder of which client each helper needs.
 */

export type FollowTargetKey = `${EntityType}:${number}`;

export function followKey(type: EntityType, id: number): FollowTargetKey {
  return `${type}:${id}`;
}

/** How many members follow this target. Service client only. */
export async function getFollowerCount(
  service: SupabaseClient,
  targetType: EntityType,
  targetId: number
): Promise<number> {
  const { count, error } = await service
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error) {
    console.error("[follows] getFollowerCount failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** How many targets this participant follows. Service client only. */
export async function getFollowingCount(
  service: SupabaseClient,
  participantId: number
): Promise<number> {
  const { count, error } = await service
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_participant_id", participantId);
  if (error) {
    console.error("[follows] getFollowingCount failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

/** Is `participantId` following (`targetType`, `targetId`)? Service client only. */
export async function isFollowing(
  service: SupabaseClient,
  participantId: number,
  targetType: EntityType,
  targetId: number
): Promise<boolean> {
  const { data, error } = await service
    .from("follows")
    .select("id")
    .eq("follower_participant_id", participantId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (error) {
    console.error("[follows] isFollowing failed:", error.message);
    return false;
  }
  return !!data;
}

/**
 * The viewer's entire follow-set as a Set of "type:id" keys — one query that
 * powers initial button state across a page and the directory Following filter.
 * Reads only the viewer's own rows, so it's safe with the RLS client too.
 */
export async function getFollowedTargetKeys(
  client: SupabaseClient,
  participantId: number
): Promise<Set<FollowTargetKey>> {
  const { data, error } = await client
    .from("follows")
    .select("target_type, target_id")
    .eq("follower_participant_id", participantId);
  if (error) {
    console.error("[follows] getFollowedTargetKeys failed:", error.message);
    return new Set();
  }
  return new Set(
    (data ?? []).map((r) => followKey(r.target_type as EntityType, r.target_id))
  );
}
