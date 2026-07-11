import type { SupabaseClient } from "@supabase/supabase-js";
import { getFollowedParticipantIds } from "./data";

/**
 * "People you may know" — follow suggestions drawn from the member's real
 * connections: podmates (strongest), then labmates (same local lab), then
 * cyclemates. Already-followed people, the viewer, and internal (test/staff)
 * accounts are excluded. Powers the dashboard rail, the directory, and the
 * onboarding "follow people you know" step.
 */

export interface Suggestion {
  id: number;
  name: string;
  initials: string;
  avatarUrl: string | null;
  handle: string | null;
  headline: string | null;
  /** Why they're suggested — "In your pod" / "In your lab" / "In your cycle". */
  reason: string;
}

const DISPLAY =
  "id, handle, preferred_name, first_name, last_name, headline, profile_image_url";

// Strongest signal first — a shared pod beats a shared lab beats a shared cycle.
const REASON_RANK: Record<string, number> = {
  "In your pod": 0,
  "In your lab": 1,
  "In your cycle": 2,
};

/** Order suggestions by reason strength, then name (pure — unit-tested). */
export function orderSuggestions(list: Suggestion[]): Suggestion[] {
  return [...list].sort(
    (a, b) =>
      (REASON_RANK[a.reason] ?? 9) - (REASON_RANK[b.reason] ?? 9) ||
      a.name.localeCompare(b.name)
  );
}

export async function getPeopleYouMayKnow(
  service: SupabaseClient,
  viewerId: number,
  opts: { metroId?: number | null; limit?: number } = {}
): Promise<Suggestion[]> {
  const limit = opts.limit ?? 6;

  // Exclude who you already follow (and yourself).
  const skip = new Set(await getFollowedParticipantIds(service, viewerId));
  skip.add(viewerId);

  // First-seen reason wins (sources are consulted in priority order).
  const reasonById = new Map<number, string>();
  const consider = (ids: (number | null)[], reason: string) => {
    for (const id of ids) {
      if (id != null && !skip.has(id) && !reasonById.has(id)) {
        reasonById.set(id, reason);
      }
    }
  };

  // 1. Podmates — members sharing an active pod with the viewer.
  const { data: myPods } = await service
    .from("pod_memberships")
    .select("pod_id")
    .eq("participant_id", viewerId)
    .is("inactive_at", null);
  const podIds = (myPods ?? []).map((r) => r.pod_id as number);
  if (podIds.length > 0) {
    const { data: mates } = await service
      .from("pod_memberships")
      .select("participant_id")
      .in("pod_id", podIds)
      .is("inactive_at", null);
    consider(
      (mates ?? []).map((r) => r.participant_id as number),
      "In your pod"
    );
  }

  // 2. Labmates — same local lab (metro).
  if (opts.metroId != null) {
    const { data: lab } = await service
      .from("participants")
      .select("id")
      .eq("metro_id", opts.metroId)
      .eq("is_test", false)
      .eq("is_staff", false)
      .limit(60);
    consider((lab ?? []).map((r) => r.id as number), "In your lab");
  }

  // 3. Cyclemates — members enrolled in the same active cycle(s).
  const { data: myCycles } = await service
    .from("cycle_enrollments")
    .select("cycle_id")
    .eq("participant_id", viewerId)
    .eq("status", "active");
  const cycleIds = (myCycles ?? []).map((r) => r.cycle_id as number);
  if (cycleIds.length > 0) {
    const { data: mates } = await service
      .from("cycle_enrollments")
      .select("participant_id")
      .in("cycle_id", cycleIds)
      .eq("status", "active")
      .limit(150);
    consider(
      (mates ?? []).map((r) => r.participant_id as number),
      "In your cycle"
    );
  }

  const candidateIds = [...reasonById.keys()];
  if (candidateIds.length === 0) return [];

  // Fetch display info; drop any internal accounts that slipped in via pods/cycles.
  const { data: people } = await service
    .from("participants")
    .select(DISPLAY)
    .in("id", candidateIds)
    .eq("is_test", false)
    .eq("is_staff", false);

  const suggestions: Suggestion[] = (people ?? []).map((p) => {
    const name =
      p.preferred_name ||
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      "A member";
    const initials =
      `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() || "•";
    return {
      id: p.id as number,
      name,
      initials,
      avatarUrl: p.profile_image_url ?? null,
      handle: p.handle ?? null,
      headline: p.headline ?? null,
      reason: reasonById.get(p.id as number) ?? "In your network",
    };
  });

  return orderSuggestions(suggestions).slice(0, limit);
}
