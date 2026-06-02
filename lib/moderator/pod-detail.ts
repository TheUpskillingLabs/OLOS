/**
 * Per-pod detail query for the Per-pod view (PRD §7.1 status header,
 * §7.3 member roster, §7.5 phase guidance).
 *
 * Shared between the RSC `app/(dashboard)/moderator/pods/[pod_id]/page.tsx`
 * and the REST endpoint `GET /api/moderator/pods/[pod_id]`. Both surfaces
 * use identical pulse-status bucketing and pod-health computation.
 *
 * This helper does NOT authorize the caller — callers must check
 * `requireModeratorForPod` (route) or run the equivalent check in the
 * RSC before invoking.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCurrentPhase, type CycleConfigPhaseColumns } from "./phase";
import {
  bandFor,
  trendOver3Weeks,
  type Band,
  type Trend,
  type PulseHealthCfg,
} from "./pulse-health";
import { atRiskNudgeKey, deriveAtRiskRun, loadDismissedKeys, isDismissed } from "./nudges";

const DEFAULT_AT_RISK_MISSES = 2;

export type PulseStatus = "current" | "pending" | "late" | "at_risk";

export type RosterRow = {
  participant_id: number;
  initials: string;
  display_name: string;
  ai_experience_level: string;
  availability_snippet: string | null;
  email: string | null;
  joined_at: string;
  is_inactive: boolean;
  inactive_since: string | null;
  pulse_status: PulseStatus;
  last_activity_at: string | null;
  /**
   * Nudge instance key for at-risk members. Null when not at-risk.
   * Re-fires when the consecutive-miss run starts over after a recovery.
   */
  nudge_key: string | null;
  /** True when the caller (poderator) has dismissed this specific nudge. */
  nudge_dismissed: boolean;
};

export type PodDetail = {
  id: number;
  name: string | null;
  status: string;
  cycle_id: number;
  cycle_name: string | null;
  phase_num: number | null;
  phase_display_name: string | null;
  phase_short_name: string | null;
  phase_open_at: string | null;
  phase_close_at: string | null;
  phase_is_active: boolean;
  active_member_count: number;
  missing_this_week: number;
  band: Band;
  trend: Trend;
  resources: {
    slack_channel_id: string | null;
    drive_folder_id: string | null;
    github_repo_url: string | null;
  };
  members: RosterRow[];
  at_risk_threshold: number;
};

export async function getPodDetail(
  supabase: SupabaseClient,
  podId: number,
  /** Caller's participant id; used to load their nudge dismissals. */
  callerParticipantId: number | null = null
): Promise<PodDetail | null> {
  const { data: pod, error: podErr } = await supabase
    .from("pods")
    .select(`
      id, name, status, cycle_id,
      slack_channel_id, drive_folder_id, github_repo_url,
      cycles (id, name)
    `)
    .eq("id", podId)
    .single();

  if (podErr || !pod) return null;

  const { data: cfg } = await supabase
    .from("cycle_config")
    .select(
      "problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close, pulse_band_warning_min, pulse_band_critical_min, at_risk_consecutive_misses"
    )
    .eq("cycle_id", pod.cycle_id as number)
    .maybeSingle();

  const phase = cfg ? resolveCurrentPhase(cfg as unknown as CycleConfigPhaseColumns) : null;
  const atRiskThreshold =
    (cfg as { at_risk_consecutive_misses?: number } | null)?.at_risk_consecutive_misses ??
    DEFAULT_AT_RISK_MISSES;

  const { data: memberRows } = await supabase
    .from("pod_memberships")
    .select(`
      participant_id, joined_at, inactive_at,
      participants (
        id, first_name, last_name, preferred_name, email,
        ai_experience_level, availability_snippet
      )
    `)
    .eq("pod_id", podId)
    .order("joined_at");

  const memberIds = (memberRows ?? []).map((m) => m.participant_id as number);

  let enrollmentsByParticipant = new Map<number, { status: string }>();
  if (memberIds.length > 0) {
    const { data: enrolls } = await supabase
      .from("cycle_enrollments")
      .select("participant_id, status")
      .eq("cycle_id", pod.cycle_id as number)
      .in("participant_id", memberIds);
    enrollmentsByParticipant = new Map(
      (enrolls ?? []).map((e) => [e.participant_id as number, { status: e.status as string }])
    );
  }

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  type PulseRow = {
    participant_id: number;
    scheduled_date: string;
    completed_at: string | null;
  };
  let pulseRows: PulseRow[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from("pulse_checks")
      .select("participant_id, scheduled_date, completed_at")
      .in("participant_id", memberIds)
      .eq("cycle_id", pod.cycle_id as number)
      .gte("scheduled_date", fourWeeksAgo.toISOString().slice(0, 10))
      .order("scheduled_date");
    pulseRows = (data ?? []) as PulseRow[];
  }

  const pulsesByMember = new Map<number, PulseRow[]>();
  for (const p of pulseRows) {
    const arr = pulsesByMember.get(p.participant_id) ?? [];
    arr.push(p);
    pulsesByMember.set(p.participant_id, arr);
  }

  // Load this poderator's nudge dismissals for this pod.
  const dismissedKeys = await loadDismissedKeys(supabase, callerParticipantId, [podId]);

  const members: RosterRow[] = (memberRows ?? []).map((m) => {
    const p = (m.participants as unknown) as {
      id: number;
      first_name: string;
      last_name: string;
      preferred_name: string | null;
      email: string;
      ai_experience_level: string;
      availability_snippet: string | null;
    } | null;

    const first = p?.preferred_name?.trim() || p?.first_name?.trim() || "?";
    const lastInitial = p?.last_name ? p.last_name[0].toUpperCase() : "";
    const display = lastInitial ? `${first} ${lastInitial}.` : first;
    const initials = `${first[0] ?? "?"}${lastInitial}`.toUpperCase();

    const memberPulses = pulsesByMember.get(m.participant_id as number) ?? [];
    const status = computePulseStatus(memberPulses, atRiskThreshold);
    const lastCompleted = memberPulses
      .filter((q) => q.completed_at)
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];

    const enrollment = enrollmentsByParticipant.get(m.participant_id as number);
    const isInactive = enrollment?.status === "inactive";

    // For at-risk members, derive the nudge_key from the current
    // consecutive-miss run so re-trips after recovery produce a fresh
    // key the dismissal table hasn't seen.
    let nudge_key: string | null = null;
    let nudge_dismissed = false;
    if (status === "at_risk") {
      const run = deriveAtRiskRun(m.participant_id as number, memberPulses);
      if (run) {
        nudge_key = atRiskNudgeKey(run);
        nudge_dismissed = isDismissed(dismissedKeys, podId, nudge_key);
      }
    }

    return {
      participant_id: m.participant_id as number,
      initials,
      display_name: display,
      ai_experience_level: p?.ai_experience_level ?? "new",
      availability_snippet: p?.availability_snippet ?? null,
      email: p?.email ?? null,
      joined_at: m.joined_at as string,
      is_inactive: isInactive,
      inactive_since: m.inactive_at as string | null,
      pulse_status: status,
      last_activity_at: lastCompleted?.completed_at ?? null,
      nudge_key,
      nudge_dismissed,
    };
  });

  // Pod-level pulse-health: only count active members.
  const activeMemberIds = (memberRows ?? [])
    .filter((m) => m.inactive_at === null)
    .map((m) => m.participant_id as number);
  const activeMemberIdSet = new Set(activeMemberIds);
  const activePulses = pulseRows.filter((p) => activeMemberIdSet.has(p.participant_id));

  const { missingThisWeek, weeklyRates } = bucketPulses(
    activePulses,
    activeMemberIds.length
  );

  return {
    id: pod.id as number,
    name: pod.name as string | null,
    status: pod.status as string,
    cycle_id: pod.cycle_id as number,
    cycle_name:
      (pod.cycles as unknown as { name: string } | null)?.name ?? null,
    phase_num: phase?.num ?? null,
    phase_display_name: phase?.displayName ?? null,
    phase_short_name: phase?.shortName ?? null,
    phase_open_at: phase?.openAt ?? null,
    phase_close_at: phase?.closeAt ?? null,
    phase_is_active: phase?.isActive ?? false,
    active_member_count: activeMemberIds.length,
    missing_this_week: missingThisWeek,
    band: bandFor(missingThisWeek, cfg as unknown as PulseHealthCfg | null),
    trend: trendOver3Weeks(weeklyRates),
    resources: {
      slack_channel_id: pod.slack_channel_id as string | null,
      drive_folder_id: pod.drive_folder_id as string | null,
      github_repo_url: pod.github_repo_url as string | null,
    },
    members,
    at_risk_threshold: atRiskThreshold,
  };
}

/** Determine the engagement bucket from a member's recent pulses. */
function computePulseStatus(
  pulses: { scheduled_date: string; completed_at: string | null }[],
  atRiskThreshold: number
): PulseStatus {
  if (pulses.length === 0) return "pending";

  const sorted = [...pulses].sort((a, b) =>
    b.scheduled_date.localeCompare(a.scheduled_date)
  );

  let consecutiveMisses = 0;
  for (const p of sorted) {
    if (p.completed_at) break;
    consecutiveMisses += 1;
  }
  if (consecutiveMisses >= atRiskThreshold) return "at_risk";

  const mostRecent = sorted[0];
  if (mostRecent.completed_at) return "current";

  const scheduledMs = new Date(mostRecent.scheduled_date).getTime();
  const ageDays = (Date.now() - scheduledMs) / 86_400_000;
  return ageDays > 7 ? "late" : "pending";
}

/** Bucket pulse rows into weeks. */
function bucketPulses(
  rows: { participant_id: number; scheduled_date: string; completed_at: string | null }[],
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
