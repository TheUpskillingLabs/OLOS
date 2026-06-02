/**
 * Recent pulses across a pod — feed view (PRD §7.4 read-only).
 *
 * Backs the "Recent pulses" tab on the per-pod page. Returns the most
 * recent submitted pulses across all members of the pod, newest first,
 * with the full survey_responses payload so the feed can render each
 * response inline (no per-row fetch).
 *
 * Auth is enforced at the route layer (same `requireModeratorForPod`
 * guard as the other /api/moderator/pods/* routes); this helper does NOT
 * check authorization.
 *
 * Pagination is cursor-based on `completed_at`: pass the oldest
 * completed_at from the previous page back as `before` to load older.
 * Page size is bounded so a single request never explodes the response.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const RECENT_PULSES_PAGE_SIZE = 20;
export const RECENT_PULSES_MAX_PAGE_SIZE = 50;

export type RecentPulse = {
  participant_id: number;
  display_name: string;
  initials: string;
  scheduled_date: string;
  completed_at: string;
  survey_responses: Record<string, unknown> | null;
};

export type RecentPulsesPayload = {
  podId: number;
  cycleId: number;
  pulses: RecentPulse[];
  /**
   * ISO timestamp of the oldest pulse in this page; pass back as `before`
   * to load the next (older) page. Null when there are no more pages.
   */
  nextCursor: string | null;
};

export async function getRecentPulses(
  supabase: SupabaseClient,
  podId: number,
  options: { before?: string | null; limit?: number } = {}
): Promise<RecentPulsesPayload | { error: "pod-not-found" }> {
  const limit = Math.min(
    Math.max(1, options.limit ?? RECENT_PULSES_PAGE_SIZE),
    RECENT_PULSES_MAX_PAGE_SIZE
  );

  // 1. Resolve cycle from the pod.
  const { data: pod } = await supabase
    .from("pods")
    .select("id, cycle_id")
    .eq("id", podId)
    .maybeSingle();
  if (!pod) return { error: "pod-not-found" };
  const cycleId = pod.cycle_id as number;

  // 2. Pod members (current or historical — we still want to show pulses
  //    from members who later left, so the feed is a complete record).
  const { data: memberRows } = await supabase
    .from("pod_memberships")
    .select(`
      participant_id,
      participants ( id, first_name, last_name, preferred_name )
    `)
    .eq("pod_id", podId);

  const memberIds = (memberRows ?? []).map((m) => m.participant_id as number);
  if (memberIds.length === 0) {
    return { podId, cycleId, pulses: [], nextCursor: null };
  }

  const nameByParticipant = new Map<
    number,
    { display_name: string; initials: string }
  >();
  for (const m of memberRows ?? []) {
    const p = (m.participants as unknown) as {
      first_name: string;
      last_name: string;
      preferred_name: string | null;
    } | null;
    const first = p?.preferred_name?.trim() || p?.first_name?.trim() || "?";
    const lastInitial = p?.last_name ? p.last_name[0].toUpperCase() : "";
    const display = lastInitial ? `${first} ${lastInitial}.` : first;
    const initials = `${first[0] ?? "?"}${lastInitial}`.toUpperCase();
    nameByParticipant.set(m.participant_id as number, {
      display_name: display,
      initials,
    });
  }

  // 3. Pull submitted pulses across the pod, newest first. Fetch limit+1
  //    so we can determine if there's a next page without a count query.
  let query = supabase
    .from("pulse_checks")
    .select("participant_id, scheduled_date, completed_at, survey_responses")
    .in("participant_id", memberIds)
    .eq("cycle_id", cycleId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(limit + 1);

  if (options.before) {
    query = query.lt("completed_at", options.before);
  }

  const { data: pulseRows } = await query;
  const rows = (pulseRows ?? []) as Array<{
    participant_id: number;
    scheduled_date: string;
    completed_at: string;
    survey_responses: Record<string, unknown> | null;
  }>;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].completed_at : null;

  const pulses: RecentPulse[] = page.map((r) => {
    const ident = nameByParticipant.get(r.participant_id) ?? {
      display_name: "?",
      initials: "?",
    };
    return {
      participant_id: r.participant_id,
      display_name: ident.display_name,
      initials: ident.initials,
      scheduled_date: r.scheduled_date,
      completed_at: r.completed_at,
      survey_responses: r.survey_responses,
    };
  });

  return { podId, cycleId, pulses, nextCursor };
}
