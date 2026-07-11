/**
 * Server-side helper for the moderator UI state (PRD §7.7 + §7.8).
 *
 * Reads the caller's `moderator_ui_state` row. Used by the All pods
 * page to decide whether to redirect first-time / returning poderators
 * to their last-viewed pod, and by both pages to seed Client UI
 * components with persisted filter/sort/tooltip state.
 *
 * Writes go through the existing /api/moderator/ui-state PUT endpoint
 * from chunk 3 (Client Components fire it on user actions).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ModeratorUiState = {
  last_view: string | null;
  roster_filters: RosterFilters;
  roster_sort: RosterSort | null;
  tooltip_seen: string[];
  last_pod_tab: PodTab | null;
};

/** Per-pod page tab (PRD §7.7 — UI state persists per poderator). */
export type PodTab = "members" | "recent_pulses";

export type RosterFilters = {
  search?: string;
  status?: string[];
  ai_level?: string[];
  show_inactive?: boolean;
  show_staff_test?: boolean;
};

export type RosterSort =
  | "name_asc"
  | "name_desc"
  | "pulse_status"
  | "last_activity_asc"
  | "last_activity_desc"
  | "ai_level";

const EMPTY: ModeratorUiState = {
  last_view: null,
  roster_filters: {},
  roster_sort: null,
  tooltip_seen: [],
  last_pod_tab: null,
};

export async function getUiState(
  supabase: SupabaseClient,
  participantId: number | null
): Promise<ModeratorUiState> {
  if (!participantId) return EMPTY;
  const { data } = await supabase
    .from("moderator_ui_state")
    .select("last_view, roster_filters, roster_sort, tooltip_seen, last_pod_tab")
    .eq("participant_id", participantId)
    .maybeSingle();
  if (!data) return EMPTY;
  return {
    last_view: (data.last_view as string | null) ?? null,
    roster_filters: ((data.roster_filters as RosterFilters | null) ?? {}) as RosterFilters,
    roster_sort: (data.roster_sort as RosterSort | null) ?? null,
    tooltip_seen: (data.tooltip_seen as string[] | null) ?? [],
    last_pod_tab: (data.last_pod_tab as PodTab | null) ?? null,
  };
}
