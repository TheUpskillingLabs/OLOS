import { createServiceClient } from "@/lib/supabase/server";

// Upskiller Spotlights (migration 00051) — published member stories for the
// public /stories page. Server-side only; anon RLS mirrors status='published'.

export type SpotlightTag = "builder" | "mentor" | "career_changer" | "other";

export interface Spotlight {
  id: number;
  slug: string | null;
  name: string;
  role: string | null;
  tag: SpotlightTag;
  tag_label: string | null;
  quote: string | null;
  story: string[];
  grad: string;
  image_url: string | null;
}

const SPOTLIGHT_COLUMNS =
  "id, slug, name, role, tag, tag_label, quote, story, grad, image_url";

export async function getPublishedSpotlights(): Promise<Spotlight[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("spotlights")
    .select(SPOTLIGHT_COLUMNS)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });
  if (error) console.error("[content] getPublishedSpotlights:", error.message);
  return (data as Spotlight[]) ?? [];
}

// One published spotlight by slug — for the /stories/[slug] detail page.
// Mirrors getResource/getEvent in lib/content/queries.ts.
export async function getSpotlight(slug: string): Promise<Spotlight | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("spotlights")
    .select(SPOTLIGHT_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) console.error("[content] getSpotlight:", error.message);
  return (data as Spotlight) ?? null;
}
