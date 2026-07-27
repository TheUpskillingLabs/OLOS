import { createServiceClient } from "@/lib/supabase/server";
import { selectMemberCycles } from "@/lib/cycle/active";
import { registrationWindow } from "@/lib/cycles/schedule";
import { windowOpen } from "@/lib/cycles/lab-time";
import { eligibleLogCycles } from "@/lib/learning-logs/eligible";
import { learningLogGate } from "@/lib/learning-logs/gate";
import { pendingBaselineCycles } from "@/lib/learning-logs/baseline";
import { leadershipScopesFor } from "@/lib/leadership-logs/scopes";
import { getFieldSurveyForCycle } from "@/lib/content/surveys";
import { SLACK_ROW_SINCE_ISO } from "./definitions";
import { dashboardTasks, type DashboardTasks } from "./tasks";

/* Admin queue preview (support/debug, /admin/tasks): compute the exact
   queue + checklist a given member sees, without being them. The input
   derivations MIRROR app/(dashboard)/dashboard/page.tsx — that page keeps
   its own copies because it needs the same rows for other sections and
   must not double-fetch on the hot path; this helper trades a few extra
   count queries for isolation on an admin-only path. If the dashboard's
   state machine changes, change this too (both feed the same
   assembleTasks, so drift here shows up only in the preview, never in
   what members see). */

export interface MemberTaskPreview {
  participant: {
    id: number;
    email: string | null;
    displayName: string;
  };
  state: string;
  tasks: DashboardTasks;
}

export async function memberTaskPreview(
  query: string
): Promise<MemberTaskPreview | null> {
  const supabase = createServiceClient();

  // Exact email match first; fall back to a substring match on email/name.
  const q = query.trim();
  if (!q) return null;
  let { data: participant } = await supabase
    .from("participants")
    .select("id, email, preferred_name, first_name, last_name, bio, headline, metro_id, created_at")
    .eq("email", q)
    .maybeSingle();
  if (!participant) {
    const { data: fuzzy } = await supabase
      .from("participants")
      .select("id, email, preferred_name, first_name, last_name, bio, headline, metro_id, created_at")
      .or(`email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(1);
    participant = fuzzy?.[0] ?? null;
  }
  if (!participant) return null;

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, slug, sector_id, start_date, end_date, status, mode, lab_id")
    .order("start_date", { ascending: false });
  const { activeCycle, upcomingCycle } = selectMemberCycles(
    cycles,
    participant.metro_id ?? null
  );

  const [
    configResult,
    enrollmentResult,
    podCountResult,
    agreementResult,
    logResult,
    followsResult,
    labLeadResult,
    logCycles,
    baselineCycles,
  ] = await Promise.all([
    activeCycle
      ? supabase
          .from("cycle_config")
          .select(
            "pod_registration_open, pod_registration_close, pod_limit, problem_statement_open, problem_statement_close, voting_open, voting_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
          )
          .eq("cycle_id", activeCycle.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    activeCycle
      ? supabase
          .from("cycle_enrollments")
          .select("id, status")
          .eq("participant_id", participant.id)
          .eq("cycle_id", activeCycle.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    activeCycle
      ? supabase
          .from("pod_memberships")
          .select("id, pods!inner(id)", { head: true, count: "exact" })
          .eq("participant_id", participant.id)
          .eq("pods.cycle_id", activeCycle.id)
          .is("inactive_at", null)
      : Promise.resolve({ count: 0 }),
    activeCycle
      ? supabase
          .from("cycle_agreements")
          .select("id", { head: true, count: "exact" })
          .eq("participant_id", participant.id)
          .eq("cycle_id", activeCycle.id)
      : Promise.resolve({ count: 0 }),
    activeCycle
      ? supabase
          .from("learning_logs")
          .select("id", { head: true, count: "exact" })
          .eq("participant_id", participant.id)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("follows")
      .select("id", { head: true, count: "exact" })
      .eq("follower_participant_id", participant.id)
      .not("followee_participant_id", "is", null),
    supabase
      .from("lab_leads")
      .select("lab_id")
      .eq("participant_id", participant.id)
      .is("removed_at", null),
    eligibleLogCycles(participant.id),
    pendingBaselineCycles(participant.id),
  ]);

  const activeCycleConfig = configResult.data;
  const enrollment = enrollmentResult.data;
  const myPodCount = podCountResult.count ?? 0;
  const hasAgreement = (agreementResult.count ?? 0) > 0;
  const logCount = logResult.count ?? 0;
  const followsAnyone = (followsResult.count ?? 0) > 0;
  const pendingBaseline = baselineCycles[0] ?? null;

  const [gate, leadScopes] = await Promise.all([
    learningLogGate(participant.id, logCycles),
    leadershipScopesFor(
      participant.id,
      (labLeadResult.data ?? []).map((r) => r.lab_id)
    ),
  ]);

  // The dashboard's state machine, verbatim.
  const podWindowOpen = windowOpen(
    activeCycleConfig?.pod_registration_open,
    activeCycleConfig?.pod_registration_close
  );
  let state = "no_cycle";
  if (activeCycle) {
    if (!enrollment) state = "no_enrollment";
    else if (enrollment.status === "active" || myPodCount > 0) state = "active";
    else if (podWindowOpen) state = "interest_submitted_window_open";
    else state = "interest_submitted_window_closed";
  }
  const onboarding = state === "no_cycle" || state === "no_enrollment";
  const registerCycleRow =
    onboarding && upcomingCycle ? upcomingCycle : activeCycle;

  let preRegisteredUpcoming = false;
  if (onboarding && upcomingCycle) {
    const { count } = await supabase
      .from("cycle_agreements")
      .select("id", { head: true, count: "exact" })
      .eq("participant_id", participant.id)
      .eq("cycle_id", upcomingCycle.id);
    preRegisteredUpcoming = (count ?? 0) > 0;
  }
  const registerDone =
    onboarding && upcomingCycle
      ? preRegisteredUpcoming
      : hasAgreement || enrollment?.status === "active";
  const regWindow =
    registerCycleRow && !registerDone
      ? await registrationWindow(supabase, registerCycleRow.id)
      : null;
  const regOpen = registerDone || (regWindow?.open ?? false);

  const surveyCohort = registerCycleRow;
  let fieldSurvey = null;
  let surveyContributed = false;
  if (surveyCohort) {
    fieldSurvey = await getFieldSurveyForCycle(
      surveyCohort.id,
      surveyCohort.sector_id ?? null
    );
    if (fieldSurvey) {
      const { count } = await supabase
        .from("survey_responses")
        .select("id", { head: true, count: "exact" })
        .eq("participant_id", participant.id)
        .eq("field_survey_id", fieldSurvey.id);
      surveyContributed = (count ?? 0) > 0;
    }
  }

  const tasks = await dashboardTasks({
    participantId: participant.id,
    profileDone: !!(participant.bio || participant.headline),
    followsAnyone,
    slackRowVisible:
      !!participant.created_at &&
      Date.parse(participant.created_at) >= Date.parse(SLACK_ROW_SINCE_ISO),
    slackInviteUrl: process.env.NEXT_PUBLIC_SLACK_INVITE_URL,
    activeCycle: activeCycle
      ? {
          id: activeCycle.id,
          name: activeCycle.name,
          mode: activeCycle.mode,
          start_date: activeCycle.start_date,
          end_date: activeCycle.end_date,
        }
      : null,
    activeCycleConfig: (activeCycleConfig ?? null) as Record<
      string,
      string | null
    > | null,
    registerCycle: registerCycleRow
      ? {
          id: registerCycleRow.id,
          name: registerCycleRow.name,
          upcoming: onboarding && !!upcomingCycle,
        }
      : null,
    registerOpen: regOpen,
    registerDone,
    myPodCount,
    podLimit:
      (activeCycleConfig as { pod_limit?: number } | null)?.pod_limit ?? 1,
    logCount,
    pendingBaseline: pendingBaseline
      ? { id: pendingBaseline.id, name: pendingBaseline.name }
      : null,
    gate: { active: gate.active, pending: gate.pending },
    leadershipDue: leadScopes
      .filter((s) => s.armed && !s.submittedThisWeek)
      .map((s) => ({
        tier: s.tier,
        cycleId: s.cycleId,
        podId: s.podId,
        labId: s.labId,
      })),
    fieldSurvey: fieldSurvey
      ? {
          id: fieldSurvey.id,
          title: fieldSurvey.title,
          shareSlug: fieldSurvey.share_slug,
        }
      : null,
    surveyContributed,
    engaged: state === "active",
  });

  return {
    participant: {
      id: participant.id,
      email: participant.email,
      displayName:
        participant.preferred_name ||
        [participant.first_name, participant.last_name].filter(Boolean).join(" ") ||
        `#${participant.id}`,
    },
    state,
    tasks,
  };
}
