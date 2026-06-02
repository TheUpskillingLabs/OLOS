/**
 * Pods-list query for the All pods view (PRD §7.10.1).
 *
 * Shared between the RSC `app/(dashboard)/moderator/page.tsx` and the
 * REST endpoint `GET /api/moderator/pods` so both surfaces use identical
 * pod selection, pulse-health computation, and sort order.
 *
 * Scope is determined by `user`:
 *   - admin / owner  → every pod
 *   - moderator      → pods with an active `moderator_assignments` row
 *
 * The pulse query is cycle-scoped to prevent cross-cycle leak when a
 * participant is enrolled in multiple cycles.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, type UserRoles } from "@/lib/auth/roles";
import { resolveCurrentPhase, type CycleConfigPhaseColumns } from "./phase";
import {
  bandFor,
  trendOver3Weeks,
  type Band,
  type Trend,
  type PulseHealthCfg,
} from "./pulse-health";

export type PodCard = {
  id: number;
  name: string | null;
  status: string;
  cycle_id: number;
  cycle_name: string | null;
  phase_num: number | null;
  phase_display_name: string | null;
  phase_open_at: string | null;
  phase_close_at: string | null;
  active_member_count: number;
  missing_this_week: number;
  band: Band;
  trend: Trend;
};

/**
 * Resolve which pods the user can see for the All pods view.
 * Returns admin scope (all pods) when the user has `cycles:write`,
 * otherwise their `moderator_assignments` set.
 */
async function resolveAccessiblePodIds(
  supabase: SupabaseClient,
  user: UserRoles
): Promise<number[]> {
  if (isAdmin(user)) {
    const { data } = await supabase
      .from("pods")
      .select("id")
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => r.id as number);
  }
  if (!user.participantId) return [];
  // moderatorPodIds is already resolved on `user`, but re-query so this
  // helper is self-contained and the API caller doesn't need to thread
  // pre-resolved state through.
  const { data } = await supabase
    .from("moderator_assignments")
    .select("pod_id")
    .eq("participant_id", user.participantId)
    .is("removed_at", null);
  return (data ?? []).map((r) => r.pod_id as number);
}

/**
 * Build the All pods view cards for `user`. Empty array when the user
 * has no accessible pods (e.g. moderator with no assignments).
 */
export async function getPodsForUser(
  supabase: SupabaseClient,
  user: UserRoles
): Promise<PodCard[]> {
  const podIds = await resolveAccessiblePodIds(supabase, user);
  if (podIds.length === 0) return [];

  // Pods + cycle metadata.
  const { data: podRows } = await supabase
    .from("pods")
    .select("id, name, status, cycle_id, cycles (id, name)")
    .in("id", podIds);

  if (!podRows || podRows.length === 0) return [];

  const cycleIds = Array.from(new Set(podRows.map((p) => p.cycle_id as number)));

  // Cycle configs (phase windows + pulse-health thresholds).
  const { data: configRows } = await supabase
    .from("cycle_config")
    .select(
      "cycle_id, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close, pulse_band_warning_min, pulse_band_critical_min"
    )
    .in("cycle_id", cycleIds);

  const configByCycle = new Map<number, CycleConfigPhaseColumns & PulseHealthCfg>();
  for (const row of configRows ?? []) {
    configByCycle.set(row.cycle_id as number, row as CycleConfigPhaseColumns & PulseHealthCfg);
  }

  // Active memberships per pod.
  const { data: membershipRows } = await supabase
    .from("pod_memberships")
    .select("pod_id, participant_id")
    .in("pod_id", podIds)
    .is("inactive_at", null);

  const membersByPod = new Map<number, number[]>();
  for (const m of membershipRows ?? []) {
    const arr = membersByPod.get(m.pod_id as number) ?? [];
    arr.push(m.participant_id as number);
    membersByPod.set(m.pod_id as number, arr);
  }

  // Last 3 weeks of pulse data for trend + missing-this-week.
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

  const allParticipantIds = Array.from(
    new Set(Array.from(membersByPod.values()).flat())
  );

  let pulseRows: {
    participant_id: number;
    cycle_id: number;
    scheduled_date: string;
    completed_at: string | null;
  }[] = [];
  if (allParticipantIds.length > 0 && cycleIds.length > 0) {
    const { data } = await supabase
      .from("pulse_checks")
      .select("participant_id, cycle_id, scheduled_date, completed_at")
      .in("participant_id", allParticipantIds)
      .in("cycle_id", cycleIds)
      .gte("scheduled_date", threeWeeksAgo.toISOString().slice(0, 10));
    pulseRows = (data ?? []) as typeof pulseRows;
  }

  // Compose cards.
  const cards: PodCard[] = podRows.map((pod) => {
    const cfg = configByCycle.get(pod.cycle_id as number) ?? null;
    const phase = cfg ? resolveCurrentPhase(cfg) : null;
    const memberIds = membersByPod.get(pod.id as number) ?? [];
    const memberIdSet = new Set(memberIds);

    const podPulses = pulseRows.filter(
      (p) => p.cycle_id === pod.cycle_id && memberIdSet.has(p.participant_id)
    );
    const { missingThisWeek, weeklyRates } = computeWeeklyRates(
      podPulses,
      memberIds.length
    );

    const cycleName =
      (pod.cycles as unknown as { name: string } | null)?.name ?? null;

    return {
      id: pod.id as number,
      name: pod.name as string | null,
      status: pod.status as string,
      cycle_id: pod.cycle_id as number,
      cycle_name: cycleName,
      phase_num: phase?.num ?? null,
      phase_display_name: phase?.displayName ?? null,
      phase_open_at: phase?.openAt ?? null,
      phase_close_at: phase?.closeAt ?? null,
      active_member_count: memberIds.length,
      missing_this_week: missingThisWeek,
      band: bandFor(missingThisWeek, cfg),
      trend: trendOver3Weeks(weeklyRates),
    };
  });

  // Sort: pods with non-zero missing first, then descending by missing,
  // then alphabetical by name (PRD §7.10.1).
  cards.sort((a, b) => {
    if ((a.missing_this_week > 0) !== (b.missing_this_week > 0)) {
      return a.missing_this_week > 0 ? -1 : 1;
    }
    if (a.missing_this_week !== b.missing_this_week) {
      return b.missing_this_week - a.missing_this_week;
    }
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return cards;
}

/**
 * Buckets pulse rows into weeks (using scheduled_date) and returns
 * { missingThisWeek, weeklyRates } where weeklyRates is the completion
 * rate (0..1) per week, oldest first.
 *
 * "This week" = the most recent week with at least one scheduled pulse
 * row for this pod's members.
 */
function computeWeeklyRates(
  rows: { scheduled_date: string; completed_at: string | null }[],
  activeCount: number
): { missingThisWeek: number; weeklyRates: number[] } {
  if (rows.length === 0 || activeCount === 0) {
    return { missingThisWeek: 0, weeklyRates: [] };
  }

  const byWeek = new Map<string, { completed: number; total: number }>();
  for (const r of rows) {
    const bucket = byWeek.get(r.scheduled_date) ?? { completed: 0, total: 0 };
    bucket.total += 1;
    if (r.completed_at) bucket.completed += 1;
    byWeek.set(r.scheduled_date, bucket);
  }

  const weekKeys = Array.from(byWeek.keys()).sort();
  const weeklyRates = weekKeys.map((k) => {
    const b = byWeek.get(k)!;
    return b.total === 0 ? 0 : b.completed / b.total;
  });

  const latestKey = weekKeys[weekKeys.length - 1];
  const latest = byWeek.get(latestKey)!;
  const missingThisWeek = Math.max(0, activeCount - latest.completed);

  return { missingThisWeek, weeklyRates };
}
