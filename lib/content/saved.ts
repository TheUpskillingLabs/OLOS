import { createServiceClient } from "@/lib/supabase/server";

// The member's saved content (saved_items, migration 00050), split by type so
// the /learning page can render a heart's initial state and build the "Saved"
// vertical from the already-fetched events/resources arrays (no per-item query).

export interface SavedSlugs {
  events: Set<string>;
  resources: Set<string>;
}

export async function getSavedSlugs(participantId: number): Promise<SavedSlugs> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("saved_items")
    .select("item_type, slug")
    .eq("participant_id", participantId);
  if (error) console.error("[content] getSavedSlugs:", error.message);
  const events = new Set<string>();
  const resources = new Set<string>();
  for (const r of (data as { item_type: string; slug: string }[]) ?? []) {
    if (r.item_type === "event") events.add(r.slug);
    else if (r.item_type === "resource") resources.add(r.slug);
  }
  return { events, resources };
}
