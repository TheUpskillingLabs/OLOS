/**
 * Pod-level pulse insights (PRD §7.9.2).
 *
 * Renders between the member roster (§7.3) and phase guidance (§7.5)
 * on the per-pod dashboard. Scoped to one pod.
 *
 * Two metrics:
 *   - Top AI tools across the pod: up to 5, ordered by member count
 *     (one heavy user doesn't dominate). Members named the tool in at
 *     least one pulse_check.survey_responses.tools_used array.
 *   - Weekly completion trend: per-week submitted / scheduled rate.
 *
 * Range is caller-controlled: 4-week default, or null = full cycle.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PodToolCount = {
  tool: string;
  members: number;
};

export type WeeklyCompletion = {
  scheduled_date: string;
  completed: number;
  total: number;
  rate: number;
};

export type PodInsights = {
  range: "4w" | "full";
  topTools: PodToolCount[];
  weekly: WeeklyCompletion[];
  /** Sample of recent free-text pulse comments — feeds the §7.10.3 bundle. */
  recentComments: PulseComment[];
};

export type PulseComment = {
  initials: string;
  participant_id: number;
  scheduled_date: string;
  /** Concatenated free-text fields from survey_responses (no field labels). */
  text: string;
};

const TOP_N_TOOLS = 5;
const FREE_TEXT_FIELDS = [
  "accomplishment",
  "highlight",
  "challenge",
  "blockers",
  "tailwinds",
  "mitigation_strategy",
  "anything_else",
] as const;

export async function getPodInsights(
  supabase: SupabaseClient,
  podId: number,
  range: "4w" | "full"
): Promise<PodInsights | null> {
  const { data: pod } = await supabase
    .from("pods")
    .select("id, cycle_id")
    .eq("id", podId)
    .maybeSingle();
  if (!pod) return null;
  const cycleId = pod.cycle_id as number;

  const { data: memberRows } = await supabase
    .from("pod_memberships")
    .select(`
      participant_id,
      participants ( first_name, last_name, preferred_name )
    `)
    .eq("pod_id", podId)
    .is("inactive_at", null);

  const memberIds = (memberRows ?? []).map((m) => m.participant_id as number);
  const memberInitials = new Map<number, string>();
  for (const m of memberRows ?? []) {
    const p = (m.participants as unknown) as {
      first_name?: string;
      last_name?: string;
      preferred_name?: string | null;
    } | null;
    const first = (p?.preferred_name?.trim() || p?.first_name?.trim() || "?")[0];
    const last = p?.last_name?.[0] ?? "";
    memberInitials.set(
      m.participant_id as number,
      `${first}${last}`.toUpperCase()
    );
  }

  let pulseRows: {
    participant_id: number;
    scheduled_date: string;
    completed_at: string | null;
    survey_responses: Record<string, unknown> | null;
  }[] = [];

  if (memberIds.length > 0) {
    const query = supabase
      .from("pulse_checks")
      .select(
        "participant_id, scheduled_date, completed_at, survey_responses"
      )
      .in("participant_id", memberIds)
      .eq("cycle_id", cycleId)
      .order("scheduled_date");

    if (range === "4w") {
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      query.gte("scheduled_date", fourWeeksAgo.toISOString().slice(0, 10));
    }

    const { data } = await query;
    pulseRows = (data ?? []) as typeof pulseRows;
  }

  // Top AI tools by distinct-member count.
  const toolMembers = new Map<string, Set<number>>();
  for (const p of pulseRows) {
    if (!p.completed_at || !p.survey_responses) continue;
    const tools = (p.survey_responses as { tools_used?: unknown }).tools_used;
    if (!Array.isArray(tools)) continue;
    for (const t of tools) {
      if (typeof t !== "string") continue;
      const trimmed = t.trim();
      if (!trimmed) continue;
      const set = toolMembers.get(trimmed) ?? new Set<number>();
      set.add(p.participant_id);
      toolMembers.set(trimmed, set);
    }
  }
  const topTools: PodToolCount[] = Array.from(toolMembers.entries())
    .map(([tool, set]) => ({ tool, members: set.size }))
    .sort((a, b) => b.members - a.members || a.tool.localeCompare(b.tool))
    .slice(0, TOP_N_TOOLS);

  // Weekly completion: bucket per scheduled_date.
  const byWeek = new Map<string, { completed: number; total: number }>();
  for (const p of pulseRows) {
    const bucket = byWeek.get(p.scheduled_date) ?? { completed: 0, total: 0 };
    bucket.total += 1;
    if (p.completed_at) bucket.completed += 1;
    byWeek.set(p.scheduled_date, bucket);
  }
  const weekly: WeeklyCompletion[] = Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scheduled_date, b]) => ({
      scheduled_date,
      completed: b.completed,
      total: b.total,
      rate: b.total === 0 ? 0 : b.completed / b.total,
    }));

  // Recent comments for §7.10.3 bundle. Most recent 24 completed pulses
  // with at least one free-text field, newest first.
  const recentComments: PulseComment[] = [];
  const sortedDesc = [...pulseRows]
    .filter((p) => p.completed_at)
    .sort((a, b) =>
      b.scheduled_date.localeCompare(a.scheduled_date) ||
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
    );
  for (const p of sortedDesc) {
    if (recentComments.length >= 24) break;
    const text = collectFreeText(p.survey_responses);
    if (!text) continue;
    recentComments.push({
      initials: memberInitials.get(p.participant_id) ?? "??",
      participant_id: p.participant_id,
      scheduled_date: p.scheduled_date,
      text,
    });
  }

  return { range, topTools, weekly, recentComments };
}

function collectFreeText(
  sr: Record<string, unknown> | null
): string {
  if (!sr) return "";
  const parts: string[] = [];
  for (const key of FREE_TEXT_FIELDS) {
    const v = sr[key];
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
  }
  return parts.join(" · ");
}
