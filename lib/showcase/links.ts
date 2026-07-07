import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntityType, LinkPlatform } from "@/lib/validations/showcase";

/**
 * Read helper for entity_links (migration 00061). The table is world-readable
 * within the members-only app (SELECT USING(true)), so either the RLS or the
 * service client works.
 */

export interface EntityLink {
  platform: LinkPlatform;
  url: string;
  label: string | null;
  sort_order: number;
}

export async function getEntityLinks(
  client: SupabaseClient,
  ownerType: EntityType,
  ownerId: number
): Promise<EntityLink[]> {
  const { data, error } = await client
    .from("entity_links")
    .select("platform, url, label, sort_order")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("sort_order", { ascending: true })
    .order("platform", { ascending: true });
  if (error) {
    console.error("[showcase] getEntityLinks failed:", error.message);
    return [];
  }
  return (data ?? []) as EntityLink[];
}
