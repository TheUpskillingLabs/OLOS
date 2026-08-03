import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Upcoming workshops (event sign-ups) for a pod's real members — shared by
 * the Overview digest panel (soonest 3, with a link out) and the full
 * Workshops sub-page (all of them). Forward-looking only: events with
 * start_at in the past are excluded, same as the panel this replaces.
 */
export interface WorkshopEvent {
  id: number;
  name: string;
  start_at: string;
  count: number;
}

export async function getPodWorkshops(
  serviceClient: SupabaseClient,
  memberIds: number[]
): Promise<WorkshopEvent[]> {
  if (memberIds.length === 0) return [];

  const { data } = await serviceClient
    .from("event_rsvps")
    .select("participant_id, events!inner(id, name, start_at, status)")
    .in("participant_id", memberIds)
    .eq("events.status", "published")
    .gte("events.start_at", new Date().toISOString().slice(0, 10));

  const byEvent = new Map<number, WorkshopEvent>();
  for (const row of data ?? []) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!event) continue;
    const entry: WorkshopEvent =
      byEvent.get(event.id) ?? { id: event.id, name: event.name, start_at: event.start_at, count: 0 };
    entry.count += 1;
    byEvent.set(event.id, entry);
  }

  return [...byEvent.values()].sort((a, b) => a.start_at.localeCompare(b.start_at));
}
