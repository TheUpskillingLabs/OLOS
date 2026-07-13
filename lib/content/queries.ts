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
  waiting: number; // live participant count for this lab (metro_id)
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

// Live per-lab counts: how many participants are affiliated with each lab
// (participants.metro_id). Drives both the active "N members" label and the
// waitlist "N people waiting" label (a waitlisted member's metro_id points at
// the waitlist lab). This replaces the old static metros.members column +
// metro_waitlist_signups tally, which drifted from reality. Test accounts are
// excluded so public counts aren't inflated.
async function withMemberCounts(
  rows: Record<string, unknown>[]
): Promise<MetroRow[]> {
  const supabase = createServiceClient();
  const { data: parts } = await supabase
    .from("participants")
    .select("metro_id")
    .not("metro_id", "is", null)
    .not("is_test", "is", true);
  const counts = new Map<number, number>();
  for (const p of (parts as { metro_id: number }[]) ?? []) {
    counts.set(p.metro_id, (counts.get(p.metro_id) ?? 0) + 1);
  }
  return rows.map((m) => {
    const n = counts.get((m as { id: number }).id) ?? 0;
    return {
      ...(m as unknown as Omit<MetroRow, "waiting" | "members">),
      members: n,
      waiting: n,
    };
  });
}

/** Active lab first, then waitlists by list size (the prototype's sort). */
export async function getMetros(): Promise<MetroRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("metros").select("*");
  if (error) console.error("[content] getMetros:", error.message);
  const rows = await withMemberCounts((data as Record<string, unknown>[]) ?? []);
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
  const [row] = await withMemberCounts([data as Record<string, unknown>]);
  return row ?? null;
}
