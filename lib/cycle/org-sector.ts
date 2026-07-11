import type { SupabaseClient } from "@supabase/supabase-js";

// The seeded sector row that homes every org cycle / workstream
// (docs/ORG_CYCLES.md §2, migration 00060). Org cycles and workstreams both
// need a sector_id and default to this one when the caller doesn't supply
// one — shared here so the lookup (and its slug) isn't duplicated across
// the routes that need it.
export const HQ_SECTOR_SLUG = "the-upskilling-labs-hq";

/** Resolve the seeded HQ sector's id, or null if the seed row is missing. */
export async function resolveHqSectorId(
  serviceClient: SupabaseClient
): Promise<number | null> {
  const { data: hqSector } = await serviceClient
    .from("sectors")
    .select("id")
    .eq("slug", HQ_SECTOR_SLUG)
    .maybeSingle();
  return hqSector?.id ?? null;
}
