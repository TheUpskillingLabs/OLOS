import Link from "next/link";
import type { ReactNode } from "react";
import { windowOpen, parseWindow, fmtLabDateTime } from "@/lib/cycles/lab-time";
import { registrationWindow } from "@/lib/cycles/schedule";
import { redirect } from "next/navigation";
import { ArrowRight, Calendar } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge, EmptyState } from "@/app/components/ui";
import CyclePhaseIndicator from "../cycles/cycle-phase-indicator";
import PodJoinSection from "./pod-join-section";
import { type MilestoneContext } from "./learning-log-card";
import { getCycleWeek, getCycleWeekStart } from "@/lib/cycle/week";
import {
  milestoneKindForWeek,
  milestoneLabel,
  type MilestoneWeeks,
} from "@/lib/cycle/milestones";
import SetupChecklist, { type ChecklistItem } from "./setup-checklist";
import CycleCommitments from "./cycle-commitments";
import UpNext, { type TodoCard } from "./up-next";
import MobileUpNextStrip, { type StripChip } from "./mobile-up-next-strip";
import DashboardHero, { type HeroStat } from "./dashboard-hero";
import QuickLinks from "./quick-links";
import ShareSurveyButton from "./share-survey-button";
import UpdatesFeed from "../directory/updates-feed";
import FeedComposer from "./feed-composer";
import ProfileMiniCard from "./profile-mini-card";
import MembershipsPanel from "./memberships-panel";
import AnnouncementsPanel from "./announcements-panel";
import PeopleYouMayKnow from "../people-you-may-know";
import { getParticipantMemberships } from "@/lib/participants/memberships";
import { ensurePageFollowsSeeded } from "@/lib/follows/seed";
import { learningLogGate } from "@/lib/learning-logs/gate";
import { eligibleLogCycles } from "@/lib/learning-logs/eligible";
import {
  pendingBaselineCycles,
  BASELINE_QUESTIONS,
  AI_USAGE_OPTIONS,
} from "@/lib/learning-logs/baseline";
import WhatsNextCard from "./whats-next-card";
import { leadershipScopesFor } from "@/lib/leadership-logs/scopes";
import { resolveUserRoles } from "@/lib/auth/roles";
import { pagesUserCanPostAs } from "@/lib/pages/authz";
import {
  workstreamLeadContext,
  labLeadContext,
} from "@/lib/leadership-logs/context";
import LeadershipLogCard, {
  type LeadershipCardScope,
} from "./leadership-log-card";
import { podNoun, moderatorNoun } from "@/lib/cycle/labels";
import { getFieldSurveyForCycle, type FieldSurvey } from "@/lib/content/surveys";

type CycleStatus = "active" | "closed" | "draft";

const STATUS_VARIANT: Record<CycleStatus, "active" | "inactive" | "draft"> = {
  active: "active",
  closed: "inactive",
  draft: "draft",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const serviceClient = createServiceClient();

  const [{ data: participant }, { data: cycles }] = await Promise.all([
    serviceClient.from("participants").select("id, preferred_name, first_name, last_name, profile_image_url, bio, headline, metro_id, handle, page_follows_seeded").eq("auth_user_id", user.id).maybeSingle(),
    serviceClient.from("cycles").select("id, name, slug, sector_id, start_date, end_date, status, mode, lab_id").order("start_date", { ascending: false }),
  ]);

  if (!participant) redirect("/register");

  // One-time seed: a member auto-follows the pages they belong to (lab, pods,
  // projects, workstreams) so page updates reach their feed. Respects later
  // manual unfollows via the page_follows_seeded flag.
  await ensurePageFollowsSeeded(serviceClient, participant);

  // Local Labs are sub-cohorts of the single HQ participant cycle
  // (docs/LOCAL_LABS.md, 00067): the open track always resolves to the HQ
  // (lab_id NULL) cycle — the member's metro selects their pod, not their
  // cycle. Only the org track stays lab-first: lab staff resolve their
  // lab's internal cycle, everyone else HQ's.
  const memberLabId: number | null = participant.metro_id ?? null;
  const pickCycle = (status: string, mode: string) =>
    (mode === "org" && memberLabId !== null
      ? cycles?.find(
          (c) => c.status === status && c.mode === mode && c.lab_id === memberLabId
        )
      : null) ??
    cycles?.find(
      (c) => c.status === status && c.mode === mode && c.lab_id === null
    ) ??
    null;

  const activeCycle = pickCycle("active", "open");

  // The cohort a not-yet-enrolled member registers for: the newest cycle open
  // for pre-registration (`upcoming`), if any. Mirrors getMemberRecruitingCycle
  // (lib/cycle/active.ts) — the signup funnel and the confirmation email
  // already point new members at this cohort, so the dashboard's join CTA has
  // to as well, or a member who signed up for the upcoming cohort lands here
  // with no path to it. `cycles` is ordered start_date desc → the first match
  // is the newest upcoming.
  const upcomingCycle = pickCycle("upcoming", "open");

  // The org-internal cycle running alongside the participant cycle
  // (docs/ORG_CYCLES.md) — lab staff resolve their lab's internal cycle,
  // everyone else HQ's. At most one is active per stream (00062).
  const orgCycle = pickCycle("active", "org");

  type PodMembership = { id: number; pod_id: number; pods: { id: number; name: string; status: string } };
  type WorkstreamMembership = {
    id: number;
    pod_id: number;
    pods: { id: number; name: string; status: string; workstream_id: number | null };
  };

  // The activeCycle detail queries and the org-cycle enrollment lookup are
  // independent of each other (different cycle ids, no shared dependency) —
  // one Promise.all instead of two sequential blocks. Each leg is a no-op
  // resolved value when its cycle doesn't exist, so the shape stays uniform.
  const [
    configResult,
    enrollmentResult,
    membershipResult,
    agreementResult,
    logResult,
    orgEnrollmentResult,
  ] = await Promise.all([
    activeCycle
      ? serviceClient
          .from("cycle_config")
          .select(
            "phase_2_start, phase_3_start, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close, pod_limit, milestone_mid_week, milestone_final_week"
          )
          .eq("cycle_id", activeCycle.id)
          .single()
      : Promise.resolve({ data: null }),
    activeCycle
      ? serviceClient
          .from("cycle_enrollments")
          .select("id, status")
          .eq("participant_id", participant.id)
          .eq("cycle_id", activeCycle.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    activeCycle
      ? serviceClient
          .from("pod_memberships")
          .select("id, pod_id, pods!inner(id, name, status)")
          .eq("participant_id", participant.id)
          .eq("pods.cycle_id", activeCycle.id)
          .is("inactive_at", null)
      : Promise.resolve({ data: null }),
    activeCycle
      ? serviceClient
          .from("cycle_agreements")
          .select("id", { head: true, count: "exact" })
          .eq("participant_id", participant.id)
          .eq("cycle_id", activeCycle.id)
      : Promise.resolve({ count: 0 }),
    activeCycle
      ? serviceClient
          .from("learning_logs")
          .select("id", { head: true, count: "exact" })
          .eq("participant_id", participant.id)
      : Promise.resolve({ count: 0 }),
    orgCycle
      ? serviceClient
          .from("cycle_enrollments")
          .select("id, status")
          .eq("participant_id", participant.id)
          .eq("cycle_id", orgCycle.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const activeCycleConfig = configResult.data;
  const enrollment = enrollmentResult.data;
  const myPods = (membershipResult.data as unknown as PodMembership[]) ?? [];
  const hasAgreement = (agreementResult.count ?? 0) > 0;
  const logCount = logResult.count ?? 0;
  // The org cycle's workstream runs — mirrors the participant-cycle pod query
  // above, scoped to orgCycle and gated on an active enrollment in it (org
  // cycles are invite-only, so an enrollment row here means staff was
  // deliberately added).
  const orgEnrollment: { id: number; status: string } | null =
    orgEnrollmentResult.data;
  const orgActive = orgEnrollment?.status === "active";

  let myWorkstreams: WorkstreamMembership[] = [];
  let coLeadPodIds = new Set<number>();

  if (orgCycle && orgActive) {
    // moderator_assignments carries its own cycle_id (SCHEMA.md), so this no
    // longer needs to wait on the membership query's pod_id list — both run
    // together instead of sequentially.
    const [{ data: workstreamMemberships }, { data: modAssignments }] =
      await Promise.all([
        serviceClient
          .from("pod_memberships")
          .select("id, pod_id, pods!inner(id, name, status, workstream_id)")
          .eq("participant_id", participant.id)
          .eq("pods.cycle_id", orgCycle.id)
          .is("inactive_at", null),
        serviceClient
          .from("moderator_assignments")
          .select("pod_id")
          .eq("participant_id", participant.id)
          .eq("cycle_id", orgCycle.id)
          .is("removed_at", null),
      ]);
    myWorkstreams =
      (workstreamMemberships as unknown as WorkstreamMembership[]) ?? [];
    coLeadPodIds = new Set((modAssignments ?? []).map((m) => m.pod_id));
  }

  // The single definition of "cycles this member can log against"
  // (lib/learning-logs/eligible.ts) — feeds the Learning Log's "Log for"
  // picker (dual-enrolled staff log against either) and agrees with the
  // gate's own resolution, so a mode='closed' active-cycle enrollment (or
  // any future mode) is never gated here but ungateable there.
  // Both derive from the member's enrollments/logs but are independent reads —
  // resolve them together. baselineCycles is the pending-baseline set (upcoming
  // OR active open cycles the member is enrolled in and hasn't filed for yet).
  const [logCycles, baselineCycles] = await Promise.all([
    eligibleLogCycles(participant.id),
    pendingBaselineCycles(participant.id),
  ]);
  const pendingBaseline = baselineCycles[0] ?? null;

  // Has the member already signed the upcoming cohort's Open Cycle Agreement?
  // Drives the "Register" checklist row + the pre-registration confirmation so
  // a member who's pre-registered for the next cohort isn't asked to do it
  // again.
  let preRegisteredUpcoming = false;
  if (upcomingCycle) {
    const { count } = await serviceClient
      .from("cycle_agreements")
      .select("id", { head: true, count: "exact" })
      .eq("participant_id", participant.id)
      .eq("cycle_id", upcomingCycle.id);
    preRegisteredUpcoming = (count ?? 0) > 0;
  }

  // Determine pod registration window status. Naive window columns are UTC
  // instants; entry + display are lab-local (lib/cycles/lab-time.ts).
  const podWindowOpen = windowOpen(
    activeCycleConfig?.pod_registration_open,
    activeCycleConfig?.pod_registration_close
  );

  // "Past cycles" = finished cohorts only (closed/archived); the upcoming
  // recruiting cohort and drafts don't belong in an archive (SECTOR_MODEL Phase A).
  const otherCycles =
    cycles?.filter((c) => c.status === "closed" || c.status === "archived") ?? [];

  const displayName =
    participant.preferred_name || participant.first_name;

  const initials = (
    (participant.first_name?.[0] ?? "") + (participant.last_name?.[0] ?? "")
  ).toUpperCase() || "?";

  const avatarUrl =
    participant.profile_image_url ||
    (user.user_metadata?.avatar_url as string | undefined) ||
    (user.user_metadata?.picture as string | undefined) ||
    null;

  // Determine enrollment state for active cycle
  type DashboardState =
    | "no_cycle"
    | "no_enrollment"
    | "interest_submitted_window_closed"
    | "interest_submitted_window_open"
    | "active";

  // The weekly Learning Log gate (fixed window — lib/learning-logs/gate.ts).
  // logCycles is the same eligibleLogCycles() result the gate would compute
  // internally, so pass it through instead of a redundant round trip.
  const logGate = await learningLogGate(participant.id, logCycles);

  // Leadership Log (docs/ORG_CYCLES.md §4a) — the org lead tiers' weekly
  // reflection, non-blocking. Resolve the scopes this member leads, then fetch
  // the tier-below context for each armed scope. Empty for non-leads.
  const { data: myLabLeadRows } = await serviceClient
    .from("lab_leads")
    .select("lab_id")
    .eq("participant_id", participant.id)
    .is("removed_at", null);
  const leadScopes = await leadershipScopesFor(
    participant.id,
    (myLabLeadRows ?? []).map((r) => r.lab_id)
  );

  // The pages this member can post AS (they admin them) — feeds the composer's
  // "Post as" selector.
  const userRoles = await resolveUserRoles(supabase, user.id);
  const postAsPages = await pagesUserCanPostAs(serviceClient, userRoles);
  const leadershipCardScopes: LeadershipCardScope[] = await Promise.all(
    leadScopes
      .filter((s) => s.armed)
      .map(async (s) => ({
        tier: s.tier,
        cycleId: s.cycleId,
        podId: s.podId,
        labId: s.labId,
        scopeLabel: s.scopeLabel,
        cycleName: s.cycleName,
        targetDay: s.targetDay,
        due: s.due,
        submittedThisWeek: s.submittedThisWeek,
        context:
          s.tier === "workstream_lead" && s.podId != null
            ? (await workstreamLeadContext(participant.id, s.podId, s.cycleId)) ?? []
            : s.tier === "lab_lead" && s.labId != null
              ? (await labLeadContext(participant.id, s.labId, s.cycleId)) ?? []
              : [],
      }))
  );

  // Milestone weeks reframe the weekly log as an evaluation, prefilled from the
  // member's own record. Weeks are admin-configurable (cycle_config, 00047).
  let milestoneCtx: MilestoneContext | null = null;
  if (activeCycle && activeCycleConfig && enrollment?.status === "active") {
    const week = getCycleWeek(
      new Date(),
      new Date(activeCycle.start_date),
      new Date(activeCycle.end_date)
    );
    const kind = milestoneKindForWeek(
      week,
      activeCycleConfig as unknown as MilestoneWeeks
    );
    if (kind) {
      const { data: last } = await serviceClient
        .from("learning_logs")
        .select("clarity, alignment, accomplished, exploring, next_focus")
        .eq("participant_id", participant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      milestoneCtx = {
        kind,
        label: milestoneLabel(kind),
        prefill: last
          ? {
              clarity: last.clarity ?? 3,
              alignment: last.alignment ?? 3,
              accomplished: last.accomplished ?? "",
              exploring: last.exploring ?? "",
              next_focus: last.next_focus ?? "",
            }
          : null,
      };
    }
  }

  let state: DashboardState = "no_cycle";
  if (activeCycle) {
    if (!enrollment) {
      state = "no_enrollment";
    } else if (enrollment.status === "active" || myPods.length > 0) {
      state = "active";
    } else if (podWindowOpen) {
      state = "interest_submitted_window_open";
    } else {
      state = "interest_submitted_window_closed";
    }
  }

  // The Learning Log is a personal journaling practice — available from the
  // moment the account exists (owner decision). Journal mode when the member
  // isn't an active cycle member; the weekly gate + pod health check only
  // apply inside an active cycle. Rendered in every dashboard state below.
  const inActiveCycle = state === "active";
  // The Learning Log now lives in the feed composer (below, top of feed). A
  // gated member is bounced here by the layout gate and must save a log to
  // escape — so when the gate is active, surface a jump-link near the top that
  // scrolls to the composer and (via the composer's #learning-log handler)
  // opens the Learning Log tab.
  // Desktop-only: on phones the strip's urgent "Log due" chip + the composer
  // sitting one viewport down (feed-first order) carry this.
  const logDueBanner = logGate.active ? (
    <a
      href="#learning-log"
      id="log-gate-banner"
      role="alert"
      className="mb-8 hidden items-center justify-between gap-4 rounded-card border border-red bg-red/5 px-5 py-4 transition-colors duration-150 hover:bg-red/10 md:flex"
    >
      <span>
        <span className="block font-semibold tracking-tight text-ink">
          Your weekly Learning Log is due
        </span>
        <span className="mt-0.5 block text-sm text-charcoal">
          Save one in your feed below and everything unlocks the moment you do.
        </span>
      </span>
      <span className="btn btn-teal shrink-0 px-4 py-2 text-sm">Log now</span>
    </a>
  ) : null;

  // The Leadership Log section — rendered for org leads (workstream/lab) with
  // an armed weekly window, in every dashboard state (a lead's org duty is
  // independent of their participant-cycle state). Non-blocking.
  const leadershipSection = leadershipCardScopes.length > 0 && (
    <section className="mb-8 scroll-mt-24" id="leadership-log">
      <div className="mb-4">
        <div className="lbl lbl-teal mb-1.5">Leadership</div>
        <h2 className="t-h3 text-ink">Your Leadership Log</h2>
        <p className="mt-1 text-sm text-meta">
          Your weekly team reflection, written in the context of your team&rsquo;s
          logs.
        </p>
      </div>
      <LeadershipLogCard scopes={leadershipCardScopes} />
    </section>
  );

  // Setup checklist — the onboarding home for a new member (prototype
  // panel-dashboard: "checklist first"). Built here so it shows in EVERY state
  // below, not only once enrolled: the profile step is always relevant; the
  // cycle steps appear when a cycle is running or open for registration.
  // SetupChecklist collapses to a strip once every row is done.
  const profileDone = !!(participant.bio || participant.headline);

  // Onboarding "follow people you know" step — done once the member follows at
  // least one other member (page follows, incl. the auto-seeded lab, don't count).
  const { count: followingCount } = await serviceClient
    .from("follows")
    .select("id", { head: true, count: "exact" })
    .eq("follower_participant_id", participant.id)
    .not("followee_participant_id", "is", null);
  const followsAnyone = (followingCount ?? 0) > 0;

  // Total network size (people + pages) — the profile card's /network link.
  const { count: followingTotal } = await serviceClient
    .from("follows")
    .select("id", { head: true, count: "exact" })
    .eq("follower_participant_id", participant.id);

  // The "Register" row leads to the cohort the member should register for. In
  // the onboarding states (no active enrollment yet) that's the upcoming cohort
  // when one is open for pre-registration — matching where the signup funnel
  // routed them — otherwise the running cohort. Once the member is engaged in
  // the active cycle the row reflects that cycle (and collapses when done), so
  // an active member isn't nagged about the next cohort.
  const onboarding = state === "no_cycle" || state === "no_enrollment";
  const registerCycle =
    onboarding && upcomingCycle ? upcomingCycle : activeCycle;
  const registerDone =
    onboarding && upcomingCycle
      ? preRegisteredUpcoming
      : hasAgreement || enrollment?.status === "active";

  // D-10 (docs/requirements/pod-registration.md): registration for a cohort
  // closes between pod-forming close and the active-join window, and again
  // after active-join ends. Gates the register checklist row and the join
  // CTA card below — members who already signed keep their done row and
  // confirmation regardless of the window.
  const regWindow =
    registerCycle && !registerDone
      ? await registrationWindow(serviceClient, registerCycle.id)
      : null;
  const regOpen = registerDone || (regWindow?.open ?? false);

  // The field survey is the cohort's opening activity and the member's first
  // CTA (SENSEMAKING_FLOW §2, Stage 0–1). Surface the survey tied to the cohort
  // the member is engaged with (its cycle, else its sector commons). The
  // checklist row flips to done once they've contributed an observation.
  const surveyCohort = registerCycle;
  let fieldSurvey: FieldSurvey | null = null;
  let surveyContributed = false;
  if (surveyCohort) {
    fieldSurvey = await getFieldSurveyForCycle(
      surveyCohort.id,
      surveyCohort.sector_id ?? null
    );
    if (fieldSurvey) {
      const { count } = await serviceClient
        .from("survey_responses")
        .select("id", { head: true, count: "exact" })
        .eq("participant_id", participant.id)
        .eq("field_survey_id", fieldSurvey.id);
      surveyContributed = (count ?? 0) > 0;
    }
  }

  const checklistItems: ChecklistItem[] = [
    // Cycle registration leads the list — it's the reason most members are
    // here, and testers looked for it above the housekeeping rows (July 2026
    // feedback: "civics/elections registration comes first"). Hidden while
    // the D-10 window is closed (nothing actionable); a signed member's done
    // row always shows.
    ...(registerCycle && regOpen
      ? [
          {
            key: "register",
            label: `Register for ${registerCycle.name}`,
            done: registerDone,
            href: `/cycles/${registerCycle.id}/join`,
            cta: "Register",
          },
        ]
      : []),
    ...(fieldSurvey
      ? [
          {
            key: "survey",
            label: "Share your field observations",
            done: surveyContributed,
            href: `/survey/${fieldSurvey.share_slug}`,
            cta: "Open",
          },
        ]
      : []),
    {
      key: "profile",
      // Label names the exact fields that flip profileDone (bio || headline),
      // so editing other profile fields not counting isn't a surprise.
      label: "Add your bio and headline",
      done: profileDone,
      href: "/profile/edit",
      cta: "Edit",
    },
    {
      key: "follow",
      label: "Follow people you know",
      done: followsAnyone,
      href: "/directory",
      cta: "Find",
    },
    // Pod + Learning Log steps belong to the running cohort — an upcoming
    // cohort has no pods yet — so these stay tied to the active cycle. The
    // pod row also waits for its registration window: showing "Choose a pod"
    // before any pod is open was a reported bug.
    ...(activeCycle && podWindowOpen
      ? [
          {
            key: "pod",
            label: "Join a pod",
            done: myPods.length > 0,
            href: `/cycles/${activeCycle.id}/register-pods`,
            cta: "Choose",
          },
        ]
      : []),
    // The Baseline Learning Log — a one-time snapshot filed before the weekly
    // ritual begins; the row is present only while a pending baseline exists
    // (it drops out the moment the member files it). Same #learning-log anchor
    // as the first-log row, sitting just above it.
    ...(pendingBaseline
      ? [
          {
            key: "baseline",
            label: "Complete your Cycle onboarding Learning Log",
            done: false,
            href: "#learning-log",
            cta: "Log",
          },
        ]
      : []),
    ...(activeCycle
      ? [
          {
            key: "log",
            label: "Save your first Learning Log",
            done: logCount > 0,
            href: "#learning-log",
            cta: "Log",
          },
        ]
      : []),
  ];

  // The prominent first-CTA card — the visual lead for the cohort's opening
  // activity. Renders above the setup checklist in every state where the cohort
  // has an open survey; pairs "contribute" with "share" (Stage 1 = Distribute).
  // Desktop-only: the strip's "Start here" chip replaces it on phones (the
  // survey page itself owns contribute/share/results).
  const fieldSurveyCard = (survey: FieldSurvey) => (
    <section className="mb-6 hidden rounded-card border border-teal/30 bg-white p-6 shadow-card md:block">
      <div className="lbl lbl-teal mb-2">Start here · Field survey</div>
      <h2 className="t-h3 text-ink">{survey.title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-meta">
        Every Build Cycle starts in the field. Add what you&apos;re seeing, then
        share the survey with people close to the problem — your observations
        shape the problems this cohort takes on.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={`/survey/${survey.share_slug}`}
          className="inline-flex items-center gap-1.5 rounded-card bg-teal-deep px-4 py-2 text-sm font-semibold tracking-tight text-white transition-colors duration-150 hover:bg-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          {surveyContributed
            ? "Add another observation"
            : "Contribute an observation"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <ShareSurveyButton slug={survey.share_slug} title={survey.title} />
      </div>
      <Link
        href={`/survey/${survey.share_slug}/results`}
        className="mt-3 inline-block text-sm font-semibold text-teal-deep hover:underline"
      >
        See what the cohort is finding &rarr;
      </Link>
    </section>
  );

  // Join / pre-register CTA card for the onboarding empty states, pointed at
  // the cohort the member should register for. For an upcoming cohort the copy
  // frames it as pre-registration; for the running cohort it's a straight join.
  type CycleCardData = {
    id: number;
    name: string;
    start_date: string | null;
    end_date: string | null;
  };
  const joinCycleCard = (cycle: CycleCardData, upcoming: boolean) => (
    <Link
      href={`/cycles/${cycle.id}/join`}
      className="group flex items-center justify-between rounded-card border border-teal/30 bg-white p-8 shadow-card transition-colors duration-150 ease-out hover:border-teal hover:bg-teal/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
    >
      <div>
        <h2 className="t-h3 text-ink">{cycle.name}</h2>
        {cycle.start_date && cycle.end_date && (
          <p className="mt-1 text-sm text-meta">
            {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
            {new Date(cycle.end_date).toLocaleDateString()}
          </p>
        )}
        <p className="mt-3 text-sm text-meta">
          {upcoming
            ? "Pre-register now to claim your spot for the next cycle."
            : "Complete this form to join the cycle."}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-base font-semibold tracking-tight text-teal-deep">
        {upcoming ? "Pre-register" : `Join ${cycle.name}`}
        <ArrowRight
          className="h-5 w-5 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );

  // Shown instead of the join card once the member has signed the upcoming
  // cohort's agreement — they're set; nothing to do until it starts.
  const preRegisteredCard = (cycle: CycleCardData) => (
    <div className="rounded-card border border-teal/30 bg-teal/[0.06] p-8 shadow-card">
      <div className="lbl lbl-teal mb-2">You&apos;re pre-registered</div>
      <h2 className="t-h3 text-ink">{cycle.name}</h2>
      <p className="mt-2 text-sm text-meta">
        You&apos;re all set for the next cycle
        {cycle.start_date
          ? ` — it kicks off ${new Date(cycle.start_date).toLocaleDateString(
              "en-US",
              { month: "long", day: "numeric" }
            )}`
          : ""}
        . We&apos;ll open your next steps here when it starts.
      </p>
    </div>
  );

  // Shown instead of the join card while the D-10 registration window is
  // closed — names the reopen instant during the dead zone (pods forming),
  // plain "closed" after active-join ends.
  const registrationClosedCard = (cycle: CycleCardData) => (
    <div className="rounded-card border border-ink/10 bg-white p-8 shadow-card">
      <div className="lbl mb-2">Registration closed</div>
      <h2 className="t-h3 text-ink">{cycle.name}</h2>
      <p className="mt-2 text-sm text-meta">
        {regWindow?.state === "dead_zone" && regWindow.reopensAt
          ? `Pods are forming right now, so registration is paused. It reopens ${fmtLabDateTime(
              regWindow.reopensAt.toISOString()
            )}, when pods open to new members.`
          : "Registration for this cycle has closed. The next Build Cycle will show up right here."}
      </p>
    </div>
  );

  // Your workstreams — the org cycle's runs the member co-leads or
  // participates in (docs/ORG_CYCLES.md). Same pods machinery as the
  // participant-cycle pod section, "Workstream"/"Co-lead" framing on this
  // org-cycle surface. Extracted so the org-only early-return states below
  // can render it too: an org-only member (active org enrollment, no
  // open-cycle enrollment) was previously invisible here — their fetched
  // myWorkstreams never rendered because those states returned early before
  // reaching this section.
  const workstreamsSection = myWorkstreams.length > 0 && (
    <section className="mb-8">
      <div className="mb-4">
        <div className="lbl lbl-teal mb-1.5">{podNoun(orgCycle?.mode, true)}</div>
        <h2 className="t-h3 text-ink">
          Your {podNoun(orgCycle?.mode, myWorkstreams.length > 1)}
        </h2>
      </div>
      <div
        className={
          myWorkstreams.length === 1 ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"
        }
      >
        {myWorkstreams.map((membership) => {
          const pod = membership.pods;
          return (
            <Link
              key={membership.id}
              href={`/pods/${pod.id}`}
              className="rounded-card border border-ink/10 bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="t-h4 text-ink">{pod.name}</h3>
                {coLeadPodIds.has(pod.id) && (
                  <StatusBadge variant="active">
                    {moderatorNoun(orgCycle?.mode)}
                  </StatusBadge>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );

  // "Up next" — the cycle actions whose window is open right now, as
  // dismissible cards (the rail shows timing; this gives the button). Derived
  // here, above the early returns, because it feeds the desktop UpNext cards
  // AND the phone strip in every state (pure math over the already-fetched
  // cycle config — no extra queries).
  const cfg = (activeCycleConfig ?? {}) as Record<string, string | null>;
  const nowMs = new Date().getTime();
  const windowClose = (k: string): string | null => {
    const o = cfg[`${k}_open`];
    const c = cfg[`${k}_close`];
    if (!o || !c) return null;
    const open = parseWindow(o) as Date;
    const close = parseWindow(c) as Date;
    return nowMs >= open.getTime() && nowMs <= close.getTime() ? c : null;
  };
  const WINDOW_TODOS = [
    { k: "problem_statement", title: "Submit a problem statement", cta: "Propose", sub: "propose" },
    { k: "voting", title: "Vote on problem statements", cta: "Vote", sub: "vote" },
    { k: "pod_registration", title: "Register for a pod", cta: "Choose pod", sub: "register-pods" },
    { k: "solution_proposal", title: "Submit your solution proposal", cta: "Propose", sub: "solutions" },
    { k: "solution_voting", title: "Cast your solution ballot", cta: "Vote", sub: "solution-vote" },
    { k: "project_registration", title: "Register for a project", cta: "Register", sub: "register-projects" },
  ];
  const upNextTodos: TodoCard[] = activeCycle
    ? WINDOW_TODOS.flatMap((w) => {
        const close = windowClose(w.k);
        if (!close) return [];
        return [
          {
            id: w.k,
            title: w.title,
            detail: `Open now — closes ${fmtLabDateTime(close)}`,
            href: `/cycles/${activeCycle.id}/${w.sub}`,
            cta: w.cta,
          },
        ];
      })
    : [];

  // The phone "Up next" strip — chips condensing the task cards that lead the
  // desktop center column, ordered by urgency. Data-driven, so onboarding
  // states naturally show only register/survey/setup. The window-todo chips
  // share ids (and the localStorage dismissal store) with the desktop UpNext
  // cards; the rest anchor into their full cards below the feed or link out.
  const checklistDone = checklistItems.filter((i) => i.done).length;
  const stripChips: StripChip[] = [
    ...(logGate.active
      ? [
          {
            id: "log-due",
            eyebrow: "Due",
            title: "Your weekly Learning Log is due",
            detail: "Save it below and everything unlocks.",
            href: "#learning-log",
            hashLink: true,
            tone: "urgent" as const,
          },
        ]
      : []),
    ...(pendingBaseline && !logGate.active
      ? [
          {
            id: "baseline",
            eyebrow: "Start here",
            title: "Complete your Cycle onboarding Learning Log",
            href: "#learning-log",
            hashLink: true,
            tone: "teal" as const,
          },
        ]
      : []),
    ...(fieldSurvey && !surveyContributed
      ? [
          {
            id: "survey",
            eyebrow: "Start here · Field survey",
            title: fieldSurvey.title,
            detail:
              "Add what you're seeing — your observations shape this cohort.",
            href: `/survey/${fieldSurvey.share_slug}`,
            tone: "teal" as const,
          },
        ]
      : []),
    ...(registerCycle && regOpen && !registerDone
      ? [
          {
            id: "register",
            title: `Register for ${registerCycle.name}`,
            detail:
              onboarding && upcomingCycle
                ? "Pre-register now to claim your spot."
                : "Complete this form to join the cycle.",
            href: `/cycles/${registerCycle.id}/join`,
          },
        ]
      : []),
    ...upNextTodos.map((t) => ({
      id: t.id,
      title: t.title,
      detail: t.detail,
      href: t.href,
      dismissible: true,
    })),
    ...(checklistItems.length > 0 && checklistDone < checklistItems.length
      ? [
          {
            id: "setup",
            title: `Finish setup · ${checklistDone}/${checklistItems.length}`,
            detail: "A few steps left to get fully set up.",
            href: "#dash-setup",
            hashLink: true,
          },
        ]
      : []),
    ...(leadershipCardScopes.some((s) => !s.submittedThisWeek)
      ? [
          {
            id: "leadership",
            eyebrow: "Leadership",
            title: "Write your Leadership Log",
            detail: "Your weekly team reflection.",
            href: "#leadership-log",
            hashLink: true,
          },
        ]
      : []),
  ];

  // Phone-only tail of the deferred task group: people discovery (moved from
  // above the composer — LinkedIn puts it after the feed) and the network row,
  // since hiding the left rail removed ProfileMiniCard's Following link — the
  // app's only other path to /network.
  const mobileDeferExtras = (
    <div className="mt-8 flex flex-col gap-4 md:hidden">
      <PeopleYouMayKnow
        viewerId={participant.id}
        metroId={memberLabId}
        limit={3}
        variant="rail"
      />
      <Link
        href="/network"
        className="flex min-h-11 items-center justify-between gap-3 rounded-card border border-ink/10 bg-white px-4 py-3 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
      >
        <span className="text-sm font-semibold text-ink">Your network</span>
        <span className="text-sm text-meta">
          Following {followingTotal ?? 0} &rarr;
        </span>
      </Link>
    </div>
  );

  // The center column's shared scaffold. DOM order (= desktop and tablet
  // visual order) keeps tasks above the feed; on phones a mobile-only flex on
  // .dash-center (globals.css) sends .dash-defer below the feed, so the strip
  // and the composer lead — the LinkedIn feed-first posture.
  const centerColumn = (tasks: ReactNode, feed: ReactNode) => (
    <div className="dash-center">
      <MobileUpNextStrip chips={stripChips} />
      <div className="dash-defer max-md:mt-8">
        {tasks}
        {mobileDeferExtras}
      </div>
      <div className="mt-8 max-md:mt-0">{feed}</div>
    </div>
  );

  // Empty state: no enrollment — the onboarding checklist leads, then the join
  // CTA. When the next cohort is open for pre-registration, the CTA points at
  // it (that's where signup routed the member), not the closing active cycle.
  //
  // An org-only member (active org enrollment, no open-cycle enrollment)
  // still hits this branch — they genuinely aren't in the participant
  // cohort, so the onboarding copy/CTA stays — but they ARE an active cycle
  // member elsewhere: the log section must use their full eligibility
  // (gate + logCycles), not forced journal mode, and their workstreams must
  // render, or the org gate locks them out of the whole app with no banner.
  // The shared 3-panel scaffold — used by EVERY dashboard state now, not just
  // the engaged one. Left = identity + the groups you belong to (empty-friendly);
  // right = org news. memberships is fetched for all states (incl. onboarding).
  const memberships = await getParticipantMemberships(participant.id, {
    metroId: memberLabId,
    activeCycle: activeCycle
      ? {
          id: activeCycle.id,
          name: activeCycle.name,
          start_date: activeCycle.start_date,
          end_date: activeCycle.end_date,
          sector_id: activeCycle.sector_id,
          mode: activeCycle.mode,
        }
      : null,
  });
  const labName = memberships.lab?.name ?? null;

  // Hidden on phones (<768px), like the right rail: identity lives behind the
  // nav avatar "Me" menu there (pure LinkedIn), and the network row in the
  // deferred group keeps /network reachable. Tablet/desktop render the rail.
  const leftPanel = (
    <div className="dash-left hidden md:flex flex-col gap-6">
      <ProfileMiniCard
        displayName={displayName}
        headline={participant.headline}
        metroName={labName}
        avatarUrl={avatarUrl}
        initials={initials}
        followingCount={followingTotal ?? 0}
      />
      <MembershipsPanel
        memberships={memberships}
        mode={activeCycle?.mode ?? null}
      />
      <QuickLinks cycleId={activeCycle?.id} metroId={participant.metro_id} />
      {otherCycles.length > 0 && (
        <details className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
          <summary className="lbl cursor-pointer hover:text-charcoal">
            Past cycles
          </summary>
          <div className="mt-4 flex flex-col gap-2">
            {otherCycles.map((cycle) => {
              const variant =
                STATUS_VARIANT[cycle.status as CycleStatus] ?? "inactive";
              return (
                <Link
                  key={cycle.id}
                  href={`/cycles/${cycle.id}`}
                  className="flex items-center justify-between gap-3 rounded-card border border-ink/10 bg-white px-4 py-3 transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {cycle.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-meta">
                      {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                      {new Date(cycle.end_date).toLocaleDateString()}
                    </span>
                  </span>
                  <StatusBadge variant={variant}>{cycle.status}</StatusBadge>
                </Link>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );

  // Hidden on phones (<768px): the single mobile column would dump this rail at
  // the very bottom, below the whole feed — the condensed strip inside feedFor
  // carries org news + PYMK there instead. Tablet/desktop render it in the rail.
  const rightPanel = (
    <aside className="dash-right hidden md:flex flex-col gap-6">
      <AnnouncementsPanel labId={memberLabId} labName={labName} />
      <PeopleYouMayKnow
        viewerId={participant.id}
        metroId={memberLabId}
        variant="rail"
      />
    </aside>
  );

  // The feed: one composer card atop the community stream. The card holds two
  // options — Update (a freeform post, public to the community or private to
  // just you) and Learning Log (the weekly ritual / journal) — with the log
  // opening by default when the weekly gate is active. `journal` mirrors the
  // matching per-state value the old Learning Log section used.
  const feedFor = (journal: boolean) => (
    <section className="space-y-4">
      {/* Phone-only condensed org news above the composer: the full right rail
          is hidden on <768px and announcements have no other mobile surface.
          PYMK moved to the deferred task group below the feed (LinkedIn
          ordering — discovery follows the feed). */}
      <div className="flex flex-col gap-4 md:hidden">
        <AnnouncementsPanel
          labId={memberLabId}
          labName={labName}
          limit={2}
          compact
        />
      </div>
      <FeedComposer
        avatarUrl={avatarUrl}
        initials={initials}
        gateActive={!journal && logGate.active}
        milestone={journal ? null : milestoneCtx}
        journal={journal}
        logCycles={logCycles}
        pendingCycleIds={logGate.pending.map((p) => p.cycleId)}
        postAsPages={postAsPages}
        baseline={
          pendingBaseline
            ? {
                cycleId: pendingBaseline.id,
                cycleName: pendingBaseline.name,
                questions: BASELINE_QUESTIONS,
                aiUsageOptions: AI_USAGE_OPTIONS,
              }
            : null
        }
      />
      <UpdatesFeed viewerParticipantId={participant.id} />
    </section>
  );

  if (state === "no_enrollment" && activeCycle) {
    return (
      <div>
        <DashboardHero
          initials={initials}
          avatarUrl={avatarUrl}
          eyebrow="Member portal"
          greeting={`Welcome, ${displayName}`}
          lede={
            orgActive
              ? "Here's your home base — your workstreams are below."
              : "You're almost in — here's how to get set up."
          }
        />
        <div className="dash-12">
          {centerColumn(
            <>
              {/* Org-only staff lead with their actual work; the cohort join CTA
                  is for the participant pipeline they're not in. */}
              {orgActive && workstreamsSection}
              {fieldSurvey && fieldSurveyCard(fieldSurvey)}
              <div id="dash-setup" className="scroll-mt-24">
                <SetupChecklist items={checklistItems} />
              </div>
              {!orgActive &&
                (upcomingCycle
                  ? preRegisteredUpcoming
                    ? preRegisteredCard(upcomingCycle)
                    : regOpen
                      ? joinCycleCard(upcomingCycle, true)
                      : registrationClosedCard(upcomingCycle)
                  : regOpen
                    ? joinCycleCard(activeCycle, false)
                    : registrationClosedCard(activeCycle))}
              {logDueBanner}
              {leadershipSection}
            </>,
            feedFor(!orgActive)
          )}
          {leftPanel}
          {rightPanel}
        </div>
      </div>
    );
  }

  // Empty state: no active cycle. If the next cohort is already open for
  // registration, lead with its join CTA instead of the "nothing running" note.
  // Same org-only carve-out as above.
  if (state === "no_cycle") {
    return (
      <div>
        <DashboardHero
          initials={initials}
          avatarUrl={avatarUrl}
          eyebrow="Member portal"
          greeting={`Welcome, ${displayName}`}
          lede={
            orgActive
              ? "Here's your home base — your workstreams are below."
              : upcomingCycle
                ? "Here's your home base — the next Build Cycle is open for registration below."
                : "Here's your home base at The Labs. The next Build Cycle will show up right here."
          }
        />
        <div className="dash-12">
          {centerColumn(
            <>
              {orgActive && workstreamsSection}
              {fieldSurvey && fieldSurveyCard(fieldSurvey)}
              {checklistItems.length > 0 && (
                <div id="dash-setup" className="scroll-mt-24">
                  <SetupChecklist items={checklistItems} />
                </div>
              )}
              {!orgActive &&
                (upcomingCycle ? (
                  preRegisteredUpcoming ? (
                    preRegisteredCard(upcomingCycle)
                  ) : regOpen ? (
                    joinCycleCard(upcomingCycle, true)
                  ) : (
                    registrationClosedCard(upcomingCycle)
                  )
                ) : (
                  <EmptyState
                    icon={Calendar}
                    title="No cycle running right now"
                    description="Check back soon for the next Build Cycle."
                  />
                ))}
              {logDueBanner}
              {leadershipSection}
            </>,
            feedFor(!orgActive)
          )}
          {leftPanel}
          {rightPanel}
        </div>
      </div>
    );
  }

  // Engaged state: user has a cycle_enrollments row — full dashboard chrome.
  // (checklistItems and upNextTodos are built above the early returns so they
  // render in every state.)

  // The per-week "What's next" nudge (weekly_messages — program-global, the
  // cycle only supplies which week it is) — surfaced only once the member has
  // actually logged this cycle week, and only for a live open cycle inside
  // its wk0→wk12 calendar. Both reads stay behind the guard so non-active
  // states pay nothing. Mirrors the POST route's selection.
  let whatsNext: { cycleId: number; week: number; message: string } | null =
    null;
  if (
    state === "active" &&
    activeCycle &&
    activeCycle.mode === "open" &&
    activeCycle.start_date &&
    activeCycle.end_date
  ) {
    const start = new Date(activeCycle.start_date);
    const end = new Date(activeCycle.end_date);
    const week = getCycleWeek(new Date(), start, end);
    if (week >= 0 && week <= 12) {
      const [{ data: weekMsg }, { count: weekLogCount }] = await Promise.all([
        serviceClient
          .from("weekly_messages")
          .select("message")
          .eq("week", week)
          .maybeSingle(),
        serviceClient
          .from("learning_logs")
          .select("id", { head: true, count: "exact" })
          .eq("participant_id", participant.id)
          .eq("cycle_id", activeCycle.id)
          .gte("created_at", getCycleWeekStart(week, start, end).toISOString()),
      ]);
      if (weekMsg?.message && (weekLogCount ?? 0) > 0) {
        whatsNext = { cycleId: activeCycle.id, week, message: weekMsg.message };
      }
    }
  }

  // Hero copy + at-a-glance stats — the identity band adapts to the state.
  const heroLede = logGate.active
    ? "Your weekly Learning Log is due — save it below and everything unlocks."
    : state === "interest_submitted_window_open"
      ? "You're on the list. Choose your pod below to lock in your spot."
      : state === "interest_submitted_window_closed"
        ? "You're in. We'll open the next step soon — here's where things stand."
        : "Here's what's happening in your cycle right now.";

  const heroStats: HeroStat[] =
    state === "active"
      ? [
          { value: logCount, label: logCount === 1 ? "Log" : "Logs" },
          { value: myPods.length, label: myPods.length === 1 ? "Pod" : "Pods" },
        ]
      : [];

  // Pods-per-member is the cycle's admin-set limit (cycle_config.pod_limit,
  // default 1). The dashboard is optimized for the one-pod case but honors a
  // higher limit if an admin raises it.
  const podLimit =
    (activeCycleConfig as { pod_limit?: number } | null)?.pod_limit ?? 1;

  const podRegOpen =
    (state === "interest_submitted_window_open" || state === "active") &&
    activeCycle &&
    podWindowOpen &&
    myPods.length < podLimit;

  return (
    <div>
      <DashboardHero
        initials={initials}
        eyebrow={activeCycle?.name ?? "Member portal"}
        greeting={`Welcome back, ${displayName}`}
        lede={heroLede}
        stats={heroStats.length > 0 ? heroStats : undefined}
      />

      {/* Phase timeline — the whole journey at a glance, full width */}
      {activeCycle && activeCycleConfig && (
        <CyclePhaseIndicator cycle={activeCycle} config={activeCycleConfig} />
      )}

      {/* Adaptive LinkedIn-style field below the timeline: left identity +
          groups (3/12), center actions + community feed (6/12), right org news
          (3/12). Three tiers via .dash-12 (globals.css): 1-col mobile → 2-col
          tablet → 12-col (3-6-3) desktop, left & right rails sticky. On phones
          the center column goes feed-first: the strip leads, the task group
          defers below the feed (mobile-only flex order in globals.css). */}
      <div className="dash-12">
        {/* CENTER — what to do now, then the community feed */}
        {centerColumn(
          <>
            {/* The field survey is the cohort's opening activity — the first CTA. */}
            {fieldSurvey && fieldSurveyCard(fieldSurvey)}

            {/* Setup leads for a new member; collapses to a strip once done. */}
            {checklistItems.length > 0 && (
              <div id="dash-setup" className="scroll-mt-24">
                <SetupChecklist items={checklistItems} />
              </div>
            )}

            {/* The Learning Log lives in the feed composer at the top of the
                feed. When the weekly gate is active the layout bounces the
                member here and locks the app until they log, so surface a
                jump-link banner up top that scrolls to the composer and opens
                the Learning Log tab. */}
            {logDueBanner}
            {leadershipSection}

            {/* Interest submitted, pod window not yet open */}
            {state === "interest_submitted_window_closed" && activeCycleConfig && (
              <div className="mb-8 rounded-card border border-ink/10 bg-white p-5 shadow-card">
                <h2 className="t-h3 text-ink">Interest submitted</h2>
                <p className="mt-1 text-sm text-meta">
                  Pod registration opens{" "}
                  {activeCycleConfig.pod_registration_open
                    ? fmtLabDateTime(activeCycleConfig.pod_registration_open)
                    : "soon"}
                  . We&apos;ll let you know when it&apos;s time to choose your
                  pods.
                </p>
              </div>
            )}

            {podRegOpen && activeCycle && (
              <PodJoinSection
                cycleId={activeCycle.id}
                participantId={participant.id}
                myPodIds={myPods.map((m) => m.pod_id)}
                podLimit={podLimit}
              />
            )}

            {/* Up next — dismissible action cards for the currently-open
                windows. Desktop-only: the strip's dismissible chips replicate
                these 1:1 on phones (same ids, same localStorage store). */}
            {upNextTodos.length > 0 && (
              <div className="hidden md:block">
                <UpNext todos={upNextTodos} />
              </div>
            )}

            {/* This week's "What's next" nudge — shown once they've logged. */}
            {whatsNext && (
              <WhatsNextCard
                cycleId={whatsNext.cycleId}
                week={whatsNext.week}
                message={whatsNext.message}
              />
            )}

            {/* My Pod — the dashboard is optimized for one pod; a single pod
                gets a full-width card, more than one falls back to a grid. */}
            {myPods.length > 0 && (
              <section className="mb-8">
                <div className="mb-4">
                  <div className="lbl lbl-teal mb-1.5">Your people</div>
                  <h2 className="t-h3 text-ink">
                    {myPods.length === 1 ? "My Pod" : "My Pods"}
                  </h2>
                </div>
                <div
                  className={
                    myPods.length === 1
                      ? "grid gap-4"
                      : "grid gap-4 sm:grid-cols-2"
                  }
                >
                  {myPods.map((membership) => {
                    const pod = membership.pods;
                    const variant =
                      pod.status === "active"
                        ? "active"
                        : pod.status === "forming"
                          ? "forming"
                          : "inactive";
                    return (
                      <Link
                        key={membership.id}
                        href={`/pods/${pod.id}`}
                        className="rounded-card border border-ink/10 bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="t-h4 text-ink">{pod.name}</h3>
                          <StatusBadge variant={variant}>
                            {pod.status}
                          </StatusBadge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Your workstreams — extracted above so the org-only early-return
                states can render it too. */}
            {workstreamsSection}

            {/* Your commitments — the dated anchor events + .ics, always
                findable. Ends the task group; the feed follows as its own
                centerColumn slot. */}
            <div className="mt-8">
              <CycleCommitments />
            </div>
          </>,
          feedFor(!inActiveCycle && !orgActive)
        )}

        {leftPanel}

        {rightPanel}
      </div>
    </div>
  );
}
