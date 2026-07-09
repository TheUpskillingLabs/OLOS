import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isFollowing, type FollowTarget } from "./data";

/**
 * Resolve the current viewer's follow state for a page (sector / workstream /
 * lab), for seeding a Follow button on the public entity pages. Returns null
 * when there's no signed-in participant (a signed-out visitor gets no button).
 */
export async function pageFollowState(
  target: FollowTarget
): Promise<{ following: boolean } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data: me } = await service
    .from("participants")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!me) return null;

  const following = await isFollowing(service, me.id, target);
  return { following };
}
