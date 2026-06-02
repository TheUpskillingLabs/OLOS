/**
 * Per-member pulse history + individual aggregation (PRD §7.4, §7.9.1).
 *
 * Backs the pulse review side panel. Two-part payload:
 *   - `aggregate` (§7.9.1) — full-cycle: top AI tools + engagement
 *     trajectory dot row. Always full cycle regardless of the response
 *     stream range (per PRD §7.4).
 *   - `responses` — per-pulse rows (scheduled_date, completed_at, the
 *     survey_responses JSON). Most recent first.
 *
 * Pod-mate verification: the participant must be (or have been) a
 * member of the pod the caller scoped the query to. Without this check
 * an assigned poderator could read any participant's pulses by
 * URL-manipulating the participant_id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PulseResponse = {
  scheduled_date: string;
  completed_at: string | null;
  survey_responses: Record<string, unknown> | null;
};

export type TrajectoryDot = {
  scheduled_date: string;
  submitted: boolean;
};

export type ToolCount = {
  tool: string;
  count: number;
};

export type IndividualAggregate = {
  topTools: ToolCount[];
  trajectory: TrajectoryDot[];
};

export type PulseHistoryPayload = {
  participantId: number;
  cycleId: number;
  aggregate: IndividualAggregate;
  responses: PulseResponse[];
};

const TOP_N_TOOLS = 5;

export async function getMemberPulseHistory(
  supabase: SupabaseClient,
  podId: number,
  participantId: number
): Promise<PulseHistoryPayload | { error: "not-pod-member" | "pod-not-found" }> {
  // 1. Resolve the pod's cycle.
  const { data: pod } = await supabase
    .from("pods")
    .select("id, cycle_id")
    .eq("id", podId)
    .maybeSingle();
  if (!pod) return { error: "pod-not-found" };
  const cycleId = pod.cycle_id as number;

  // 2. Verify membership in this pod (any historical row — includes
  //    inactive members so the side panel can render for them too).
  const { data: membership } = await supabase
    .from("pod_memberships")
    .select("id")
    .eq("pod_id", podId)
    .eq("participant_id", participantId)
    .maybeSingle();
  if (!membership) return { error: "not-pod-member" };

  // 3. Pull pulses for the participant in this pod's cycle.
  const { data: pulseRows } = await supabase
    .from("pulse_checks")
    .select("scheduled_date, completed_at, survey_responses")
    .eq("participant_id", participantId)
    .eq("cycle_id", cycleId)
    .order("scheduled_date", { ascending: false });

  const responses = (pulseRows ?? []) as PulseResponse[];

  // 4. Build aggregate.
  const aggregate = buildAggregate(responses);

  return {
    participantId,
    cycleId,
    aggregate,
    responses,
  };
}

function buildAggregate(responses: PulseResponse[]): IndividualAggregate {
  // Trajectory: oldest → newest for the dot row.
  const trajectory: TrajectoryDot[] = [...responses]
    .reverse()
    .map((r) => ({
      scheduled_date: r.scheduled_date,
      submitted: r.completed_at !== null,
    }));

  // Tool counts: tools_used is a string[] on survey_responses (see
  // lib/validations/pulse-checks.ts). Count one mention per pulse per
  // tool — repeats within the same pulse don't double-count.
  const counts = new Map<string, number>();
  for (const r of responses) {
    if (!r.completed_at || !r.survey_responses) continue;
    const tools = (r.survey_responses as { tools_used?: unknown }).tools_used;
    if (!Array.isArray(tools)) continue;
    const seenInPulse = new Set<string>();
    for (const t of tools) {
      if (typeof t !== "string") continue;
      const trimmed = t.trim();
      if (!trimmed || seenInPulse.has(trimmed)) continue;
      seenInPulse.add(trimmed);
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }

  const topTools: ToolCount[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_N_TOOLS)
    .map(([tool, count]) => ({ tool, count }));

  return { topTools, trajectory };
}
