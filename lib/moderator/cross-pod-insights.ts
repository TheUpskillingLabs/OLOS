/**
 * Cross-pod pulse insights (PRD §7.9.3).
 *
 * Renders on the All pods view between the §7.10.2 rollup and the
 * AI-assisted summary block. Scoped to the union of pods the
 * poderator can see. Suppressed for single-pod poderators (PRD §7.10).
 *
 * Two metrics:
 *   - AI tool adoption by pod: top tools across all pods + per-pod
 *     breakdown of member-distinct counts.
 *   - Engagement comparison: per-pod weekly completion rate (latest
 *     week + 3-week trend) for side-by-side comparison.
 *
 * Plus the comment bundle for the §7.10.3 cross-pod AI summary.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PulseComment, WeeklyCompletion } from "./pod-insights";

export type CrossPodToolRow = {
  tool: string;
  members: number;
  byPod: { pod_id: number; pod_name: string; members: number }[];
};

export type CrossPodEngagementRow = {
  pod_id: number;
  pod_name: string;
  thisWeekRate: number; // 0..1
  thisWeekCompleted: number;
  thisWeekTotal: number;
  weekly: WeeklyCompletion[]; // for sparkline use
};

export type CrossPodInsights = {
  range: "4w" | "full";
  topTools: CrossPodToolRow[];
  engagement: CrossPodEngagementRow[];
  recentComments: PulseComment[];
};

const TOP_N_TOOLS = 5;
const TOP_N_RECENT_COMMENTS = 32;
const FREE_TEXT_FIELDS = [
  "accomplishment",
  "highlight",
  "challenge",
  "blockers",
  "tailwinds",
  "mitigation_strategy",
  "anything_else",
] as const;

export async function getCrossPodInsights(
  supabase: SupabaseClient,
  podIds: number[],
  range: "4w" | "full"
): Promise<CrossPodInsights | null> {
  if (podIds.length === 0) {
    return { range, topTools: [], engagement: [], recentComments: [] };
  }

  // Pods + their cycle_ids, names.
  const { data: pods } = await supabase
    .from("pods")
    .select("id, name, cycle_id")
    .in("id", podIds);
  if (!pods || pods.length === 0) {
    return { range, topTools: [], engagement: [], recentComments: [] };
  }

  const podNameById = new Map<number, string>();
  const podCycle = new Map<number, number>();
  for (const p of pods) {
    podNameById.set(p.id as number, (p.name as string) ?? `Pod ${p.id}`);
    podCycle.set(p.id as number, p.cycle_id as number);
  }
  const cycleIds = Array.from(new Set(podCycle.values()));

  // Active memberships → (participant, pod) pairs, plus participants
  // for initials.
  const { data: memRows } = await supabase
    .from("pod_memberships")
    .select(`
      pod_id, participant_id,
      participants ( first_name, last_name, preferred_name )
    `)
    .in("pod_id", podIds)
    .is("inactive_at", null);

  const memberPod = new Map<number, number>(); // participant → pod
  const memberInitials = new Map<number, string>();
  for (const m of memRows ?? []) {
    memberPod.set(m.participant_id as number, m.pod_id as number);
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
  const participantIds = Array.from(memberPod.keys());
  if (participantIds.length === 0) {
    return { range, topTools: [], engagement: [], recentComments: [] };
  }

  // Pulse data scoped by cycle + participant.
  const query = supabase
    .from("pulse_checks")
    .select(
      "participant_id, cycle_id, scheduled_date, completed_at, survey_responses"
    )
    .in("participant_id", participantIds)
    .in("cycle_id", cycleIds)
    .order("scheduled_date");
  if (range === "4w") {
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    query.gte("scheduled_date", fourWeeksAgo.toISOString().slice(0, 10));
  }
  const { data: pulseData } = await query;

  type PulseRow = {
    participant_id: number;
    cycle_id: number;
    scheduled_date: string;
    completed_at: string | null;
    survey_responses: Record<string, unknown> | null;
  };
  const pulseRows = (pulseData ?? []) as PulseRow[];

  // Drop cross-cycle leaks (pulse from a participant in a different
  // cycle than their pod's cycle).
  const cleanPulses = pulseRows.filter((p) => {
    const pid = memberPod.get(p.participant_id);
    if (pid === undefined) return false;
    const expectedCycle = podCycle.get(pid);
    return expectedCycle === p.cycle_id;
  });

  // AI tools — distinct members per tool, plus per-pod breakdown.
  const toolMembers = new Map<string, Set<number>>();
  const toolPodMembers = new Map<string, Map<number, Set<number>>>();
  for (const p of cleanPulses) {
    if (!p.completed_at || !p.survey_responses) continue;
    const pod = memberPod.get(p.participant_id);
    if (pod === undefined) continue;
    const tools = (p.survey_responses as { tools_used?: unknown }).tools_used;
    if (!Array.isArray(tools)) continue;
    for (const t of tools) {
      if (typeof t !== "string") continue;
      const trimmed = t.trim();
      if (!trimmed) continue;
      const set = toolMembers.get(trimmed) ?? new Set<number>();
      set.add(p.participant_id);
      toolMembers.set(trimmed, set);

      const byPodMap = toolPodMembers.get(trimmed) ?? new Map<number, Set<number>>();
      const ps = byPodMap.get(pod) ?? new Set<number>();
      ps.add(p.participant_id);
      byPodMap.set(pod, ps);
      toolPodMembers.set(trimmed, byPodMap);
    }
  }
  const topTools: CrossPodToolRow[] = Array.from(toolMembers.entries())
    .map(([tool, set]) => ({
      tool,
      members: set.size,
      byPod: Array.from(toolPodMembers.get(tool)?.entries() ?? [])
        .map(([pid, members]) => ({
          pod_id: pid,
          pod_name: podNameById.get(pid) ?? `Pod ${pid}`,
          members: members.size,
        }))
        .sort((a, b) => b.members - a.members || a.pod_name.localeCompare(b.pod_name)),
    }))
    .sort((a, b) => b.members - a.members || a.tool.localeCompare(b.tool))
    .slice(0, TOP_N_TOOLS);

  // Engagement comparison — per-pod weekly buckets, latest week summarised.
  const byPodWeek = new Map<number, Map<string, { completed: number; total: number }>>();
  for (const p of cleanPulses) {
    const pod = memberPod.get(p.participant_id);
    if (pod === undefined) continue;
    const podMap = byPodWeek.get(pod) ?? new Map();
    const bucket = podMap.get(p.scheduled_date) ?? { completed: 0, total: 0 };
    bucket.total += 1;
    if (p.completed_at) bucket.completed += 1;
    podMap.set(p.scheduled_date, bucket);
    byPodWeek.set(pod, podMap);
  }

  const engagement: CrossPodEngagementRow[] = podIds.map((pod_id) => {
    const podMap = byPodWeek.get(pod_id) ?? new Map();
    const weeks = Array.from(podMap.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const weekly: WeeklyCompletion[] = weeks.map(([scheduled_date, b]) => ({
      scheduled_date,
      completed: b.completed,
      total: b.total,
      rate: b.total === 0 ? 0 : b.completed / b.total,
    }));
    const latest = weekly[weekly.length - 1];
    return {
      pod_id,
      pod_name: podNameById.get(pod_id) ?? `Pod ${pod_id}`,
      thisWeekRate: latest?.rate ?? 0,
      thisWeekCompleted: latest?.completed ?? 0,
      thisWeekTotal: latest?.total ?? 0,
      weekly,
    };
  });
  engagement.sort((a, b) => b.thisWeekRate - a.thisWeekRate);

  // Recent comments bundle — newest first, capped.
  const recentComments: PulseComment[] = [];
  const sortedDesc = [...cleanPulses]
    .filter((p) => p.completed_at)
    .sort((a, b) =>
      b.scheduled_date.localeCompare(a.scheduled_date) ||
      (b.completed_at ?? "").localeCompare(a.completed_at ?? "")
    );
  for (const p of sortedDesc) {
    if (recentComments.length >= TOP_N_RECENT_COMMENTS) break;
    const text = collectFreeText(p.survey_responses);
    if (!text) continue;
    recentComments.push({
      initials: memberInitials.get(p.participant_id) ?? "??",
      participant_id: p.participant_id,
      scheduled_date: p.scheduled_date,
      text,
    });
  }

  return { range, topTools, engagement, recentComments };
}

function collectFreeText(sr: Record<string, unknown> | null): string {
  if (!sr) return "";
  const parts: string[] = [];
  for (const key of FREE_TEXT_FIELDS) {
    const v = sr[key];
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
  }
  return parts.join(" · ");
}
