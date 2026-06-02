import { NextResponse, NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireModeratorForPod } from "@/lib/auth/moderator";
import { parseIntParam } from "@/lib/api/params";
import { resolveCurrentPhase, type CycleConfigPhaseColumns } from "@/lib/moderator/phase";
import { bandFor, trendOver3Weeks, type Band, type Trend, type PulseHealthCfg } from "@/lib/moderator/pulse-health";

/**
 * GET /api/moderator/pods/[pod_id]
 *
 * Backs the Per-pod view (§7.1 status header + §7.3 member roster).
 *
 * Single endpoint by design — the page needs pod + cycle + phase +
 * pulse-health + roster in one render pass. Splitting into multiple
 * round-trips would burn an extra waterfall for no gain.
 *
 * Pod-scoped: requires admin OR active moderator assignment for this pod.
 */

type PulseStatus = "current" | "pending" | "late" | "at_risk";

type RosterRow = {
  participant_id: number;
  initials: string;             // "L.P." — for privacy-light renderings
  display_name: string;         // "Linda P." — first name + last initial
  ai_experience_level: string;  // enum value
  availability_snippet: string | null;
  email: string | null;         // poderator can see, for Slack DM fallback
  joined_at: string;
  is_inactive: boolean;         // cycle_enrollments.status === 'inactive'
  inactive_since: string | null;
  pulse_status: PulseStatus;
  last_activity_at: string | null;
};

type PodDetail = {
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

const DEFAULT_AT_RISK_MISSES = 2;

export const GET = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const guard = requireModeratorForPod(auth.user, podId);
    if (guard) return guard;

    // 1. Pod + cycle.
    const { data: pod, error: podErr } = await auth.supabase
      .from("pods")
      .select(`
        id, name, status, cycle_id,
        slack_channel_id, drive_folder_id, github_repo_url,
        cycles (id, name)
      `)
      .eq("id", podId)
      .single();

    if (podErr || !pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    // 2. cycle_config.
    const { data: cfg } = await auth.supabase
      .from("cycle_config")
      .select(
        "problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close, pulse_band_warning_min, pulse_band_critical_min, at_risk_consecutive_misses"
      )
      .eq("cycle_id", pod.cycle_id)
      .maybeSingle();

    const phase = cfg ? resolveCurrentPhase(cfg as CycleConfigPhaseColumns) : null;
    const atRiskThreshold =
      (cfg as { at_risk_consecutive_misses?: number } | null)?.at_risk_consecutive_misses ??
      DEFAULT_AT_RISK_MISSES;

    // 3. Pod members.
    const { data: memberRows, error: memErr } = await auth.supabase
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

    if (memErr) {
      return NextResponse.json({ error: "Failed to load roster" }, { status: 500 });
    }

    const memberIds = (memberRows ?? []).map((m) => m.participant_id);

    // 4. cycle_enrollments for inactive-status flagging.
    let enrollmentsByParticipant = new Map<number, { status: string }>();
    if (memberIds.length > 0) {
      const { data: enrolls } = await auth.supabase
        .from("cycle_enrollments")
        .select("participant_id, status")
        .eq("cycle_id", pod.cycle_id)
        .in("participant_id", memberIds);
      enrollmentsByParticipant = new Map(
        (enrolls ?? []).map((e) => [e.participant_id, { status: e.status }])
      );
    }

    // 5. Recent pulses (last ~4 weeks worth) for status computation + trend.
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    let pulseRows: { participant_id: number; scheduled_date: string; completed_at: string | null }[] = [];
    if (memberIds.length > 0) {
      const { data } = await auth.supabase
        .from("pulse_checks")
        .select("participant_id, scheduled_date, completed_at")
        .in("participant_id", memberIds)
        .eq("cycle_id", pod.cycle_id)
        .gte("scheduled_date", fourWeeksAgo.toISOString().slice(0, 10))
        .order("scheduled_date");
      pulseRows = data ?? [];
    }

    // 6. Group pulses by member.
    const pulsesByMember = new Map<number, typeof pulseRows>();
    for (const p of pulseRows) {
      const arr = pulsesByMember.get(p.participant_id) ?? [];
      arr.push(p);
      pulsesByMember.set(p.participant_id, arr);
    }

    // 7. Build roster rows.
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

      const first = p?.preferred_name ?? p?.first_name ?? "?";
      const lastInitial = p?.last_name ? p.last_name[0].toUpperCase() : "";
      const display = `${first} ${lastInitial}.`.trim();
      const initials = `${first[0]}${lastInitial}`.toUpperCase();

      const memberPulses = pulsesByMember.get(m.participant_id) ?? [];
      const status = computePulseStatus(memberPulses, atRiskThreshold);
      const lastCompleted = memberPulses
        .filter((p) => p.completed_at)
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];

      const enrollment = enrollmentsByParticipant.get(m.participant_id);
      const isInactive = enrollment?.status === "inactive";

      return {
        participant_id: m.participant_id,
        initials,
        display_name: display,
        ai_experience_level: p?.ai_experience_level ?? "new",
        availability_snippet: p?.availability_snippet ?? null,
        email: p?.email ?? null,
        joined_at: m.joined_at,
        is_inactive: isInactive,
        inactive_since: m.inactive_at,
        pulse_status: status,
        last_activity_at: lastCompleted?.completed_at ?? null,
      };
    });

    // 8. Pod-level pulse-health summary (matches pods/route.ts shape).
    const activeMemberIds = (memberRows ?? [])
      .filter((m) => m.inactive_at === null)
      .map((m) => m.participant_id);
    const activePulses = pulseRows.filter((p) => activeMemberIds.includes(p.participant_id));

    const { missingThisWeek, weeklyRates } = bucketPulses(
      activePulses,
      activeMemberIds.length
    );

    const detail: PodDetail = {
      id: pod.id,
      name: pod.name,
      status: pod.status,
      cycle_id: pod.cycle_id,
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
      band: bandFor(missingThisWeek, cfg as PulseHealthCfg | null),
      trend: trendOver3Weeks(weeklyRates),
      resources: {
        slack_channel_id: pod.slack_channel_id,
        drive_folder_id: pod.drive_folder_id,
        github_repo_url: pod.github_repo_url,
      },
      members,
      at_risk_threshold: atRiskThreshold,
    };

    return NextResponse.json(detail);
  }
);

/** Determine the engagement bucket from a member's recent pulses. */
function computePulseStatus(
  pulses: { scheduled_date: string; completed_at: string | null }[],
  atRiskThreshold: number
): PulseStatus {
  if (pulses.length === 0) return "pending";

  // Sort newest-first for consecutive-miss counting.
  const sorted = [...pulses].sort((a, b) =>
    b.scheduled_date.localeCompare(a.scheduled_date)
  );

  // Consecutive misses from most recent backwards.
  let consecutiveMisses = 0;
  for (const p of sorted) {
    if (p.completed_at) break;
    consecutiveMisses += 1;
  }
  if (consecutiveMisses >= atRiskThreshold) return "at_risk";

  const mostRecent = sorted[0];
  if (mostRecent.completed_at) return "current";

  // Most recent missed. If the scheduled_date is within the last 7 days,
  // call it "pending" (window may still be open). Otherwise "late".
  const scheduledMs = new Date(mostRecent.scheduled_date).getTime();
  const ageDays = (Date.now() - scheduledMs) / 86_400_000;
  return ageDays > 7 ? "late" : "pending";
}

/** Buckets pulse rows into weeks. Same logic as pods/route.ts. */
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
