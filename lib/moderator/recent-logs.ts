/**
 * Recent Learning Logs across a pod — feed view.
 *
 * Backs the Learning Logs side of the per-pod "Recent activity" tab
 * (default view; pulse checks sit behind the toggle). Mirrors
 * recent-pulses.ts: newest first, cursor pagination on created_at,
 * cycle-scoped so a dual-enrolled member's other-cycle logs never bleed
 * into this pod's feed (same attribution rule as log-health.ts).
 *
 * Auth is enforced at the route layer (requireModeratorForPod); this
 * helper does NOT check authorization.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const RECENT_LOGS_PAGE_SIZE = 20;
export const RECENT_LOGS_MAX_PAGE_SIZE = 50;

export type RecentLog = {
  participant_id: number;
  display_name: string;
  initials: string;
  created_at: string;
  schema_version: string | null;
  is_blocked: boolean;
  blocker_context: string | null;
  /* v1 prompts */
  accomplished: string | null;
  exploring: string | null;
  next_focus: string | null;
  /* v2 prompts */
  contribution: string | null;
  learned: string | null;
  feeling_word: string | null;
};

export type RecentLogsPayload = {
  podId: number;
  cycleId: number;
  logs: RecentLog[];
  /** created_at of the oldest log in this page; pass back as `before`
      to load older. Null when there are no more pages. */
  nextCursor: string | null;
};

export async function getRecentLogs(
  supabase: SupabaseClient,
  podId: number,
  options: { before?: string | null; limit?: number } = {}
): Promise<RecentLogsPayload | { error: "pod-not-found" }> {
  const limit = Math.min(
    Math.max(1, options.limit ?? RECENT_LOGS_PAGE_SIZE),
    RECENT_LOGS_MAX_PAGE_SIZE
  );

  const { data: pod } = await supabase
    .from("pods")
    .select("id, cycle_id")
    .eq("id", podId)
    .maybeSingle();
  if (!pod) return { error: "pod-not-found" };
  const cycleId = pod.cycle_id as number;

  // Current or historical members — logs from members who later left stay
  // visible, so the feed is a complete record (same choice as pulses).
  const { data: memberRows } = await supabase
    .from("pod_memberships")
    .select(`
      participant_id,
      participants ( id, first_name, last_name, preferred_name )
    `)
    .eq("pod_id", podId);

  const memberIds = (memberRows ?? []).map((m) => m.participant_id as number);
  if (memberIds.length === 0) {
    return { podId, cycleId, logs: [], nextCursor: null };
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

  let query = supabase
    .from("learning_logs")
    .select(
      "participant_id, created_at, schema_version, is_blocked, blocker_context, accomplished, exploring, next_focus, contribution, learned, feeling_word"
    )
    .in("participant_id", memberIds)
    .eq("cycle_id", cycleId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data: logRows } = await query;
  const rows = (logRows ?? []) as Array<
    Omit<RecentLog, "display_name" | "initials">
  >;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1].created_at : null;

  const logs: RecentLog[] = page.map((r) => {
    const ident = nameByParticipant.get(r.participant_id) ?? {
      display_name: "?",
      initials: "?",
    };
    return { ...r, ...ident };
  });

  return { podId, cycleId, logs, nextCursor };
}
