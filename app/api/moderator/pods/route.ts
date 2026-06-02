import { NextResponse, NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { isAdmin, isModerator } from "@/lib/auth/roles";
import { resolveCurrentPhase, type CycleConfigPhaseColumns } from "@/lib/moderator/phase";
import { bandFor, trendOver3Weeks, type Band, type Trend, type PulseHealthCfg } from "@/lib/moderator/pulse-health";

/**
 * GET /api/moderator/pods
 *
 * Backs the All pods view (§7.10.1 pod summary cards + §7.10.2 rollup).
 *
 * Returns one row per pod the caller can access:
 *   - admin/owner → all pods, all cycles
 *   - moderator → only pods with an active moderator_assignment
 *
 * Each row carries enough data to render the pod summary card:
 *   - id, name, status, cycle name, cycle phase (number + display name)
 *   - missingThisWeek + band (healthy/warning/critical)
 *   - 3-week trend (up/down/flat)
 *   - activeMemberCount
 */

type PodCard = {
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

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    if (!isModerator(auth.user) && !isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const participantId = auth.user.participantId;
    const admin = isAdmin(auth.user);

    // 1. Determine which pod IDs the caller can see.
    let podIds: number[];
    if (admin) {
      const { data, error } = await auth.supabase
        .from("pods")
        .select("id")
        .order("created_at", { ascending: false });
      if (error) {
        return NextResponse.json({ error: "Failed to load pods" }, { status: 500 });
      }
      podIds = (data ?? []).map((r) => r.id);
    } else {
      if (!participantId) return NextResponse.json([]);
      const { data, error } = await auth.supabase
        .from("moderator_assignments")
        .select("pod_id")
        .eq("participant_id", participantId)
        .is("removed_at", null);
      if (error) {
        return NextResponse.json({ error: "Failed to load assignments" }, { status: 500 });
      }
      podIds = (data ?? []).map((r) => r.pod_id);
    }

    if (podIds.length === 0) return NextResponse.json([]);

    // 2. Fetch pod + cycle metadata in one round trip.
    const { data: podRows, error: podsErr } = await auth.supabase
      .from("pods")
      .select("id, name, status, cycle_id, cycles (id, name)")
      .in("id", podIds);

    if (podsErr) {
      return NextResponse.json({ error: "Failed to load pod details" }, { status: 500 });
    }

    const cycleIds = Array.from(new Set((podRows ?? []).map((p) => p.cycle_id)));

    // 3. cycle_config (phase windows + pulse-health thresholds).
    const { data: configRows } = await auth.supabase
      .from("cycle_config")
      .select(
        "cycle_id, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close, pulse_band_warning_min, pulse_band_critical_min"
      )
      .in("cycle_id", cycleIds);

    const configByCycle = new Map<number, CycleConfigPhaseColumns & PulseHealthCfg>();
    for (const row of configRows ?? []) {
      configByCycle.set(row.cycle_id, row);
    }

    // 4. Active membership counts per pod.
    const { data: membershipRows } = await auth.supabase
      .from("pod_memberships")
      .select("pod_id, participant_id")
      .in("pod_id", podIds)
      .is("inactive_at", null);

    const membersByPod = new Map<number, number[]>();
    for (const m of membershipRows ?? []) {
      const arr = membersByPod.get(m.pod_id) ?? [];
      arr.push(m.participant_id);
      membersByPod.set(m.pod_id, arr);
    }

    // 5. Last 3 weeks of pulse data scoped to the union of pod members.
    //    A pulse is "completed" when completed_at IS NOT NULL.
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
      const { data } = await auth.supabase
        .from("pulse_checks")
        .select("participant_id, cycle_id, scheduled_date, completed_at")
        .in("participant_id", allParticipantIds)
        .in("cycle_id", cycleIds)
        .gte("scheduled_date", threeWeeksAgo.toISOString().slice(0, 10));
      pulseRows = data ?? [];
    }

    // 6. Compute per-pod health + trend.
    const cards: PodCard[] = (podRows ?? []).map((pod) => {
      const cfg = configByCycle.get(pod.cycle_id) ?? null;
      const phase = cfg ? resolveCurrentPhase(cfg) : null;
      const memberIds = membersByPod.get(pod.id) ?? [];

      // Filter pulses by both cycle (avoid cross-cycle leak when a member
      // appears in more than one cycle) and pod membership.
      const memberIdSet = new Set(memberIds);
      const podPulses = pulseRows.filter(
        (p) => p.cycle_id === pod.cycle_id && memberIdSet.has(p.participant_id)
      );
      const { missingThisWeek, weeklyRates } = computeWeeklyRates(podPulses, memberIds.length);

      const cycleName =
        (pod.cycles as unknown as { name: string } | null)?.name ?? null;

      return {
        id: pod.id,
        name: pod.name,
        status: pod.status,
        cycle_id: pod.cycle_id,
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

    // Sort: pods with non-zero missing first (within those, descending by
    // missing); then alphabetical by name (PRD §7.10.1).
    cards.sort((a, b) => {
      if ((a.missing_this_week > 0) !== (b.missing_this_week > 0)) {
        return a.missing_this_week > 0 ? -1 : 1;
      }
      if (a.missing_this_week !== b.missing_this_week) {
        return b.missing_this_week - a.missing_this_week;
      }
      return (a.name ?? "").localeCompare(b.name ?? "");
    });

    return NextResponse.json(cards);
  }
);

/**
 * Buckets pulse rows into weeks (using scheduled_date) and returns
 * { missingThisWeek, weeklyRates } where weeklyRates is the completion
 * rate (0..1) per week, oldest first.
 *
 * "This week" = the most recent week with at least one scheduled pulse
 * row for this pod's members.
 */
function computeWeeklyRates(
  rows: { participant_id: number; scheduled_date: string; completed_at: string | null }[],
  activeCount: number
): { missingThisWeek: number; weeklyRates: number[] } {
  if (rows.length === 0 || activeCount === 0) {
    return { missingThisWeek: 0, weeklyRates: [] };
  }

  // Group by scheduled_date (ISO yyyy-mm-dd).
  const byWeek = new Map<string, { completed: number; total: number }>();
  for (const r of rows) {
    const bucket = byWeek.get(r.scheduled_date) ?? { completed: 0, total: 0 };
    bucket.total += 1;
    if (r.completed_at) bucket.completed += 1;
    byWeek.set(r.scheduled_date, bucket);
  }

  const weekKeys = Array.from(byWeek.keys()).sort(); // oldest first
  const weeklyRates = weekKeys.map((k) => {
    const b = byWeek.get(k)!;
    return b.total === 0 ? 0 : b.completed / b.total;
  });

  // "Missing this week" = active members who didn't complete the latest week's pulse.
  const latestKey = weekKeys[weekKeys.length - 1];
  const latest = byWeek.get(latestKey)!;
  const missingThisWeek = Math.max(0, activeCount - latest.completed);

  return { missingThisWeek, weeklyRates };
}
