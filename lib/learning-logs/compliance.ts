import { createServiceClient } from "@/lib/supabase/server";
import {
  consecutiveMissedLogWeeks,
  memberCadenceFloor,
} from "@/lib/learning-logs/at-risk";
import {
  resolveLogCompliance,
  complianceRank,
  type LogComplianceState,
} from "@/lib/learning-logs/compliance-logic";

/* The Supabase-reading wrapper for Learning Log compliance (the soft-nudge
   layer — see compliance-logic.ts for the pure matrix and the "why"). It
   computes, per active, mode='open' cycle the member is actively enrolled in,
   the three signals resolveLogCompliance needs, using the SAME reads and the
   SAME floor as the revocation cron (app/api/cron/revocation-check) so the
   nudge a member sees and the warning that cron would later send tell one
   consistent story.

   Service client: cycle_enrollments / access-adjacent reads are admin-scoped
   under RLS, and this is called from a server component (dashboard) and a cron,
   never from a cookie-bound user context.

   This module READS ONLY. It never locks, warns, or writes — the nudge surfaces
   act on what it returns. */

export interface MemberCycleCompliance extends LogComplianceState {
  cycleId: number;
  cycleName: string;
}

/** The most urgent cycle to lead with when a dual-enrolled member has more than
    one — highest status rank, then most missed weeks. Pure; exported so both
    the dashboard and tests can reuse the same tie-break. Returns null on []. */
export function mostUrgentCompliance(
  list: MemberCycleCompliance[]
): MemberCycleCompliance | null {
  return (
    [...list].sort(
      (a, b) =>
        complianceRank(b.status) - complianceRank(a.status) ||
        b.missedWeeks - a.missedWeeks
    )[0] ?? null
  );
}

export async function getMemberLogCompliance(
  participantId: number
): Promise<MemberCycleCompliance[]> {
  const supabase = createServiceClient();
  const now = new Date();

  // Active participant cycles only. Org cycles (mode='org') run the Leadership
  // Log cadence, not this one — scoping to 'open' keeps the nudge off staff, the
  // same way the revocation cron does.
  const { data: cycles } = await supabase
    .from("cycles")
    .select(
      "id, name, start_date, end_date, cycle_config(log_due_at, log_gate_paused, at_risk_consecutive_misses)"
    )
    .eq("status", "active")
    .eq("mode", "open");
  if (!cycles || cycles.length === 0) return [];

  const cycleIds = cycles.map((c) => c.id);

  // The member must hold a status='active' enrollment in the cycle — the weekly
  // cadence has teeth only for in-pod members (a pre-pod 'registered' member can
  // log but is never nudged). enrolled_at is one half of the missed-week floor.
  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select("cycle_id, enrolled_at")
    .eq("participant_id", participantId)
    .eq("status", "active")
    .in("cycle_id", cycleIds);
  if (!enrollments || enrollments.length === 0) return [];

  const enrolledByCycle = new Map(
    enrollments.map((e) => [e.cycle_id, e.enrolled_at as string | null])
  );

  const results: MemberCycleCompliance[] = [];

  for (const cycle of cycles) {
    if (!enrolledByCycle.has(cycle.id)) continue;

    const config = Array.isArray(cycle.cycle_config)
      ? cycle.cycle_config[0]
      : cycle.cycle_config;

    const armed = !!config?.log_due_at && !config.log_gate_paused;
    const atRiskThreshold = config?.at_risk_consecutive_misses ?? 2;

    // The member's logs attributed to this cycle drive both signals.
    const { data: logRows } = await supabase
      .from("learning_logs")
      .select("created_at")
      .eq("participant_id", participantId)
      .eq("cycle_id", cycle.id);
    const logDates = (logRows ?? []).map((r) => new Date(r.created_at));

    const hasLoggedThisWindow =
      armed &&
      logDates.some((d) => d.getTime() >= new Date(config!.log_due_at).getTime());

    // Missed-week floor, identical to the revocation cron's. Both halves must be
    // dateable or consecutiveMissedLogWeeks returns 0 (never guess a miss).
    let missedWeeks = 0;
    if (armed && cycle.start_date && cycle.end_date) {
      // windowArmedSince: earliest cycle-attributed log across the whole cohort
      // (there is no stored first-armed timestamp — log_due_at is a rolling
      // stamp). Null ⇒ no evidence the ritual ran ⇒ zero misses for everyone.
      const { data: firstLogRow } = await supabase
        .from("learning_logs")
        .select("created_at")
        .eq("cycle_id", cycle.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const windowArmedSince = firstLogRow?.created_at
        ? new Date(firstLogRow.created_at)
        : null;

      // memberActiveSince: the later of enrolled_at and the earliest still-active
      // pod join in this cycle.
      const { data: podJoinRows } = await supabase
        .from("pod_memberships")
        .select("joined_at, pods!inner(cycle_id)")
        .eq("participant_id", participantId)
        .eq("pods.cycle_id", cycle.id)
        .is("inactive_at", null);
      let earliestPodJoin: Date | null = null;
      for (const row of podJoinRows ?? []) {
        if (!row.joined_at) continue;
        const joined = new Date(row.joined_at);
        if (!earliestPodJoin || joined < earliestPodJoin) earliestPodJoin = joined;
      }

      const enrolledAt = enrolledByCycle.get(cycle.id);
      missedWeeks = consecutiveMissedLogWeeks(
        now,
        new Date(cycle.start_date),
        new Date(cycle.end_date),
        logDates,
        {
          memberActiveSince: memberCadenceFloor(
            enrolledAt ? new Date(enrolledAt) : null,
            earliestPodJoin
          ),
          windowArmedSince,
        }
      );
    }

    const state = resolveLogCompliance({
      isActiveMember: true,
      armed,
      hasLoggedThisWindow,
      missedWeeks,
      atRiskThreshold,
    });

    results.push({ ...state, cycleId: cycle.id, cycleName: cycle.name });
  }

  return results;
}
