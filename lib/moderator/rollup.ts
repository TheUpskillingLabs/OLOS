/**
 * Members-needing-attention rollup (PRD §7.10.2).
 *
 * Four KPIs aggregated across every pod the poderator can see:
 *   1. pulsingThisWeek      — submitted vs total active members this week
 *   2. atRisk               — count of members at the consecutive-miss
 *                              threshold (§7.2), plus pods affected
 *   3. pulsesThisPeriod     — submitted vs possible over the default
 *                              4-week window (PRD §7.9 / §7.10.2)
 *   4. engagementTrend      — aggregate weekly completion rate %, plus
 *                              3-week trend arrow and prior-week value
 *
 * The at-risk threshold can vary per cycle (`cycle_config.at_risk_consecutive_misses`),
 * so evaluation is performed per (member, cycle) pair.
 *
 * Data scope mirrors `pods-list.ts`: pulses are filtered by cycle and
 * pod membership so a participant in multiple cycles can't leak signal
 * across them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { trendOver3Weeks, type Trend } from "./pulse-health";

const DEFAULT_AT_RISK_MISSES = 2;
const DEFAULT_PERIOD_WEEKS = 4;

export interface RollupInput {
  /** Pod IDs the poderator can see (already access-checked). */
  podIds: number[];
}

export interface RollupResult {
  totalActiveMembers: number;
  totalPodsCovered: number;
  pulsingThisWeek: {
    submitted: number;
    total: number;
    /** completed / total as integer percent (0..100). 0 when total is 0. */
    percent: number;
  };
  atRisk: {
    /** Count of distinct members at or over the configured threshold. */
    members: number;
    /** Count of pods that contain at least one at-risk member. */
    podsAffected: number;
  };
  pulsesThisPeriod: {
    submitted: number;
    possible: number;
    periodWeeks: number;
  };
  engagementTrend: {
    /** Aggregate completion % for the most recent week (0..100). */
    currentPercent: number;
    /** Prior-week completion % (0..100). null when only one week of data. */
    priorPercent: number | null;
    trend: Trend;
  };
}

const EMPTY: RollupResult = {
  totalActiveMembers: 0,
  totalPodsCovered: 0,
  pulsingThisWeek: { submitted: 0, total: 0, percent: 0 },
  atRisk: { members: 0, podsAffected: 0 },
  pulsesThisPeriod: { submitted: 0, possible: 0, periodWeeks: DEFAULT_PERIOD_WEEKS },
  engagementTrend: { currentPercent: 0, priorPercent: null, trend: "flat" },
};

export async function getRollup(
  supabase: SupabaseClient,
  { podIds }: RollupInput,
  periodWeeks: number = DEFAULT_PERIOD_WEEKS
): Promise<RollupResult> {
  if (podIds.length === 0) return EMPTY;

  // Pod → cycle map (and the set of cycles we need configs for).
  const { data: podRows } = await supabase
    .from("pods")
    .select("id, cycle_id")
    .in("id", podIds);

  const podCycle = new Map<number, number>();
  for (const p of podRows ?? []) {
    podCycle.set(p.id as number, p.cycle_id as number);
  }
  const cycleIds = Array.from(new Set(podCycle.values()));
  if (cycleIds.length === 0) return EMPTY;

  // Per-cycle at-risk threshold.
  const { data: cfgRows } = await supabase
    .from("cycle_config")
    .select("cycle_id, at_risk_consecutive_misses")
    .in("cycle_id", cycleIds);

  const atRiskByCycle = new Map<number, number>();
  for (const c of cfgRows ?? []) {
    atRiskByCycle.set(
      c.cycle_id as number,
      (c.at_risk_consecutive_misses as number | null) ?? DEFAULT_AT_RISK_MISSES
    );
  }

  // Active pod memberships → (pod_id, participant_id) pairs.
  const { data: memRows } = await supabase
    .from("pod_memberships")
    .select("pod_id, participant_id")
    .in("pod_id", podIds)
    .is("inactive_at", null);

  const memberPods = new Map<number, Set<number>>(); // participant → pods
  const podMembers = new Map<number, Set<number>>(); // pod → participants
  for (const m of memRows ?? []) {
    const pid = m.participant_id as number;
    const pod = m.pod_id as number;
    const ps = memberPods.get(pid) ?? new Set<number>();
    ps.add(pod);
    memberPods.set(pid, ps);
    const ms = podMembers.get(pod) ?? new Set<number>();
    ms.add(pid);
    podMembers.set(pod, ms);
  }

  const totalActiveMembers = memberPods.size;
  const totalPodsCovered = podMembers.size;
  if (totalActiveMembers === 0) {
    return { ...EMPTY, totalPodsCovered, pulsesThisPeriod: { ...EMPTY.pulsesThisPeriod, periodWeeks } };
  }

  // Pulse window: enough to cover both at-risk consecutive-miss counting
  // and the configured period. Pull the larger of the two horizons.
  const maxThreshold = Math.max(
    ...Array.from(atRiskByCycle.values()),
    DEFAULT_AT_RISK_MISSES
  );
  const horizonWeeks = Math.max(periodWeeks, maxThreshold + 1);
  const since = new Date();
  since.setDate(since.getDate() - horizonWeeks * 7);

  const participantIds = Array.from(memberPods.keys());
  const { data: pulseRows } = await supabase
    .from("pulse_checks")
    .select("participant_id, cycle_id, scheduled_date, completed_at")
    .in("participant_id", participantIds)
    .in("cycle_id", cycleIds)
    .gte("scheduled_date", since.toISOString().slice(0, 10))
    .order("scheduled_date", { ascending: false });

  type PulseRow = {
    participant_id: number;
    cycle_id: number;
    scheduled_date: string;
    completed_at: string | null;
  };
  const pulses = (pulseRows ?? []) as PulseRow[];

  // Group pulses by (participant, cycle).
  const pulsesByMemberCycle = new Map<string, PulseRow[]>();
  for (const p of pulses) {
    const k = `${p.participant_id}:${p.cycle_id}`;
    const arr = pulsesByMemberCycle.get(k) ?? [];
    arr.push(p);
    pulsesByMemberCycle.set(k, arr);
  }

  // Bucket pulses by scheduled_date globally for engagement trend +
  // pulses-this-period. Each pulse is one possible submission.
  const byWeek = new Map<string, { completed: number; total: number }>();
  // Bound the period bucket to the period horizon (4 weeks default).
  const periodCutoff = new Date();
  periodCutoff.setDate(periodCutoff.getDate() - periodWeeks * 7);
  const periodCutoffStr = periodCutoff.toISOString().slice(0, 10);

  let periodSubmitted = 0;
  let periodPossible = 0;
  for (const p of pulses) {
    const bucket = byWeek.get(p.scheduled_date) ?? { completed: 0, total: 0 };
    bucket.total += 1;
    if (p.completed_at) bucket.completed += 1;
    byWeek.set(p.scheduled_date, bucket);

    if (p.scheduled_date >= periodCutoffStr) {
      periodPossible += 1;
      if (p.completed_at) periodSubmitted += 1;
    }
  }

  const weekKeys = Array.from(byWeek.keys()).sort();

  // Pulsing this week: latest scheduled_date bucket.
  let submittedThisWeek = 0;
  if (weekKeys.length > 0) {
    const latest = byWeek.get(weekKeys[weekKeys.length - 1])!;
    submittedThisWeek = latest.completed;
  }
  const pulsingTotal = totalActiveMembers;
  const pulsingPercent =
    pulsingTotal === 0 ? 0 : Math.round((submittedThisWeek / pulsingTotal) * 100);

  // Engagement trend: aggregate weekly completion rate over the data.
  const weeklyRates = weekKeys.map((k) => {
    const b = byWeek.get(k)!;
    return b.total === 0 ? 0 : b.completed / b.total;
  });
  const currentPercent =
    weeklyRates.length === 0
      ? 0
      : Math.round(weeklyRates[weeklyRates.length - 1] * 100);
  const priorPercent =
    weeklyRates.length < 2
      ? null
      : Math.round(weeklyRates[weeklyRates.length - 2] * 100);
  const trend = trendOver3Weeks(weeklyRates);

  // At-risk: per (member, cycle), count consecutive misses from the most
  // recent backwards and compare to that cycle's threshold.
  let atRiskMembers = 0;
  const atRiskPodSet = new Set<number>();
  for (const [key, rows] of pulsesByMemberCycle.entries()) {
    const [pidStr, cidStr] = key.split(":");
    const participantId = Number(pidStr);
    const cycleId = Number(cidStr);
    const threshold = atRiskByCycle.get(cycleId) ?? DEFAULT_AT_RISK_MISSES;

    // rows are already DESC by scheduled_date (selected with that order).
    let consecutiveMisses = 0;
    for (const r of rows) {
      if (r.completed_at) break;
      consecutiveMisses += 1;
    }
    if (consecutiveMisses >= threshold) {
      atRiskMembers += 1;
      const pods = memberPods.get(participantId);
      if (pods) {
        for (const podId of pods) {
          if (podCycle.get(podId) === cycleId) atRiskPodSet.add(podId);
        }
      }
    }
  }

  return {
    totalActiveMembers,
    totalPodsCovered,
    pulsingThisWeek: {
      submitted: submittedThisWeek,
      total: pulsingTotal,
      percent: pulsingPercent,
    },
    atRisk: {
      members: atRiskMembers,
      podsAffected: atRiskPodSet.size,
    },
    pulsesThisPeriod: {
      submitted: periodSubmitted,
      possible: periodPossible,
      periodWeeks,
    },
    engagementTrend: {
      currentPercent,
      priorPercent,
      trend,
    },
  };
}
