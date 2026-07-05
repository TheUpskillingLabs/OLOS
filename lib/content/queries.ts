import { createServiceClient } from "@/lib/supabase/server";

// Public content reads (the mini-CMS tables — see migration 00033).
// Server-side only; pages render these, anon RLS mirrors the same visibility.

export interface EventRow {
  id: number;
  api_id: string | null;
  slug: string;
  name: string;
  kind: string | null;
  start_at: string;
  end_at: string | null;
  location_type: "in_person" | "virtual";
  location_name: string | null;
  img: string | null;
  grad: string | null;
  cost: string;
  host: string | null;
  description: string | null;
  bring: string | null;
  body: string[] | null;
  gallery: string[] | null;
  anchor: boolean;
  luma_url: string | null;
  synced_at: string | null; // set = Luma-managed row (migration 00035)
}

export interface ResourceRow {
  id: number;
  slug: string;
  title: string;
  content_type: "guide" | "recording" | "template" | "course" | "playbook";
  meta: string | null;
  img: string | null;
  grad: string | null;
  summary: string | null;
  tags: string[] | null;
  from_line: string | null;
  author: string | null;
  url: string | null;
  license: string | null;
  body: string[] | null;
}

export interface MetroRow {
  id: number;
  slug: string;
  name: string;
  st: string | null;
  status: "active" | "waitlist";
  partner: string | null;
  members: number | null;
  waiting_baseline: number;
  blurb: string | null;
  waiting: number; // baseline + live signups
}

export async function getEvents(): Promise<EventRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("status", "published")
    .order("start_at", { ascending: true });
  if (error) console.error("[content] getEvents:", error.message);
  return (data as EventRow[]) ?? [];
}

export async function getEvent(slug: string): Promise<EventRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as EventRow) ?? null;
}

export async function getResources(): Promise<ResourceRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("status", "published")
    .order("id", { ascending: true });
  if (error) console.error("[content] getResources:", error.message);
  return (data as ResourceRow[]) ?? [];
}

export async function getResource(slug: string): Promise<ResourceRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("resources")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as ResourceRow) ?? null;
}

async function withWaiting(rows: Record<string, unknown>[]): Promise<MetroRow[]> {
  const supabase = createServiceClient();
  const { data: signups } = await supabase
    .from("metro_waitlist_signups")
    .select("metro_id");
  const counts = new Map<number, number>();
  for (const s of (signups as { metro_id: number }[]) ?? []) {
    counts.set(s.metro_id, (counts.get(s.metro_id) ?? 0) + 1);
  }
  return rows.map((m) => ({
    ...(m as unknown as Omit<MetroRow, "waiting">),
    waiting:
      ((m as { waiting_baseline: number }).waiting_baseline ?? 0) +
      (counts.get((m as { id: number }).id) ?? 0),
  }));
}

/** Active lab first, then waitlists by list size (the prototype's sort). */
export async function getMetros(): Promise<MetroRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("metros").select("*");
  if (error) console.error("[content] getMetros:", error.message);
  const rows = await withWaiting((data as Record<string, unknown>[]) ?? []);
  return rows.sort((a, b) =>
    a.status === "active" ? -1 : b.status === "active" ? 1 : b.waiting - a.waiting
  );
}

export async function getMetro(slug: string): Promise<MetroRow | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("metros")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const [row] = await withWaiting([data as Record<string, unknown>]);
  return row ?? null;
}
