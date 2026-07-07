import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calendar } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge, EmptyState } from "@/app/components/ui";
import CyclePhaseIndicator from "../cycles/cycle-phase-indicator";
import PodJoinSection from "./pod-join-section";
import LearningLogCard, { type MilestoneContext } from "./learning-log-card";
import { getCycleWeek } from "@/lib/cycle/week";
import {
  milestoneKindForWeek,
  milestoneLabel,
  type MilestoneWeeks,
} from "@/lib/cycle/milestones";
import SetupChecklist, { type ChecklistItem } from "./setup-checklist";
import CycleCommitments from "./cycle-commitments";
import UpNext, { type TodoCard } from "./up-next";
import DashboardHero, { type HeroStat } from "./dashboard-hero";
import QuickLinks from "./quick-links";
import { learningLogGate } from "@/lib/learning-logs/gate";
import { eligibleLogCycles } from "@/lib/learning-logs/eligible";
import { podNoun, moderatorNoun } from "@/lib/cycle/labels";

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
    serviceClient.from("participants").select("id, preferred_name, first_name, last_name, profile_image_url, bio, headline").eq("auth_user_id", user.id).maybeSingle(),
    serviceClient.from("cycles").select("id, name, slug, start_date, end_date, status, mode").order("start_date", { ascending: false }),
  ]);

  if (!participant) redirect("/register");

  const activeCycle =
    cycles?.find((c) => c.status === "active" && c.mode === "open") ?? null;

  // The cohort a not-yet-enrolled member registers for: the newest cycle open
  // for pre-registration (`upcoming`), if any. Mirrors getRecruitingCycle
  // (lib/cycle/active.ts) — the signup funnel and the confirmation email
  // already point new members at this cohort, so the dashboard's join CTA has
  // to as well, or a member who signed up for the upcoming cohort lands here
  // with no path to it. `cycles` is ordered start_date desc → the first match
  // is the newest upcoming.
  const upcomingCycle =
    cycles?.find((c) => c.status === "upcoming" && c.mode === "open") ?? null;

  // The org cycle running alongside the participant cycle (docs/ORG_CYCLES.md)
  // — a workstream's quarterly run reuses the same pods/cycles machinery,
  // just scoped to mode 'org'. At most one is active at a time today.
  const orgCycle =
    cycles?.find((c) => c.status === "active" && c.mode === "org") ?? null;

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
  const logCycles = await eligibleLogCycles(participant.id);

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

  // Determine pod registration window status
  let podWindowOpen = false;
  if (activeCycleConfig) {
    const now = new Date();
    const open = activeCycleConfig.pod_registration_open;
    const close = activeCycleConfig.pod_registration_close;
    if (open && close) {
      podWindowOpen = now >= new Date(open) && now <= new Date(close);
    }
  }

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
  const logSectionFor = (journal: boolean) => (
    <section className="mb-8" id="learning-log">
      <div className="mb-4">
        <div className="lbl lbl-teal mb-1.5">
          {journal ? "Your practice" : "Weekly practice"}
        </div>
        <h2 className="t-h3 text-ink">Your Learning Log</h2>
      </div>
      {!journal && logGate.active && (
        <div
          className="mb-4 rounded-card border border-red bg-red/5 px-5 py-4"
          role="alert"
          id="log-gate-banner"
        >
          <p className="font-semibold tracking-tight text-ink">
            Your weekly Learning Log is due
          </p>
          <p className="mt-0.5 text-sm text-charcoal">
            Save one below and everything unlocks the moment you do.
          </p>
        </div>
      )}
      <LearningLogCard
        gateActive={!journal && logGate.active}
        milestone={journal ? null : milestoneCtx}
        journal={journal}
        logCycles={logCycles}
        pendingCycleIds={logGate.pending.map((p) => p.cycleId)}
      />
    </section>
  );

  // Setup checklist — the onboarding home for a new member (prototype
  // panel-dashboard: "checklist first"). Built here so it shows in EVERY state
  // below, not only once enrolled: the profile step is always relevant; the
  // cycle steps appear when a cycle is running or open for registration.
  // SetupChecklist collapses to a strip once every row is done.
  const profileDone = !!(participant.bio || participant.headline);

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

  const checklistItems: ChecklistItem[] = [
    {
      key: "profile",
      label: "Complete your profile",
      done: profileDone,
      href: "/profile/edit",
      cta: "Edit",
    },
    ...(registerCycle
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
    // Pod + Learning Log steps belong to the running cohort — an upcoming
    // cohort has no pods yet — so these stay tied to the active cycle.
    ...(activeCycle
      ? [
          {
            key: "pod",
            label: "Join a pod",
            done: myPods.length > 0,
            href: `/cycles/${activeCycle.id}/register-pods`,
            cta: "Choose",
          },
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
            ? "Pre-register now to claim your spot for the next cohort."
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
        You&apos;re all set for the next cohort
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
  if (state === "no_enrollment" && activeCycle) {
    return (
      <div>
        <DashboardHero
          initials={initials}
          avatarUrl={avatarUrl}
          eyebrow="Member portal"
          greeting={`Welcome, ${displayName}`}
          lede="You're almost in — here's how to get set up."
        />
        <SetupChecklist items={checklistItems} />
        {upcomingCycle
          ? preRegisteredUpcoming
            ? preRegisteredCard(upcomingCycle)
            : joinCycleCard(upcomingCycle, true)
          : joinCycleCard(activeCycle, false)}
        {workstreamsSection}
        <div className="mt-8">{logSectionFor(!orgActive)}</div>
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
            upcomingCycle
              ? "Here's your home base — the next Build Cycle is open for registration below."
              : "Here's your home base at The Labs. The next Build Cycle will show up right here."
          }
        />
        {checklistItems.length > 0 && <SetupChecklist items={checklistItems} />}
        {upcomingCycle ? (
          preRegisteredUpcoming ? (
            preRegisteredCard(upcomingCycle)
          ) : (
            joinCycleCard(upcomingCycle, true)
          )
        ) : (
          <EmptyState
            icon={Calendar}
            title="No cycle running right now"
            description="Check back soon for the next Build Cycle."
          />
        )}
        {workstreamsSection}
        <div className="mt-8">{logSectionFor(!orgActive)}</div>
      </div>
    );
  }

  // Engaged state: user has a cycle_enrollments row — full dashboard chrome.
  // (checklistItems is built above the early returns so it renders in every state.)

  // "Up next" — the cycle actions whose window is open right now, as
  // dismissible cards (the rail shows timing; this gives the button).
  const cfg = (activeCycleConfig ?? {}) as Record<string, string | null>;
  const nowMs = new Date().getTime();
  const windowClose = (k: string): Date | null => {
    const o = cfg[`${k}_open`];
    const c = cfg[`${k}_close`];
    if (!o || !c) return null;
    return nowMs >= new Date(o).getTime() && nowMs <= new Date(c).getTime()
      ? new Date(c)
      : null;
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
            detail: `Open now — closes ${close.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`,
            href: `/cycles/${activeCycle.id}/${w.sub}`,
            cta: w.cta,
          },
        ];
      })
    : [];

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

      {/* Two-column working layout: the main column carries what to do now;
          the right rail carries the durable utilities (LinkedIn's rail in
          the light system). Collapses to a single column below 768px. */}
      <div className="dash">
        <div>
          {/* Setup leads for a new member; collapses to a strip once done. */}
          {checklistItems.length > 0 && <SetupChecklist items={checklistItems} />}

          {/* The Learning Log — a personal journaling practice on Home (Phase
              1; replaces the pulse-check CTA). Active cycle members get the
              weekly ritual + gate + pod health check; everyone else journals
              (journal mode). The gate banner + lock apply only inside a
              cycle — an org-only member (orgActive) is an active cycle
              member too, so journal mode is wrong for them even in the
              interest-submitted states below. */}
          {logSectionFor(!inActiveCycle && !orgActive)}

          {/* Interest submitted, pod window not yet open */}
          {state === "interest_submitted_window_closed" && activeCycleConfig && (
            <div className="mb-8 rounded-card border border-ink/10 bg-white p-5 shadow-card">
              <h2 className="t-h3 text-ink">Interest submitted</h2>
              <p className="mt-1 text-sm text-meta">
                Pod registration opens{" "}
                {activeCycleConfig.pod_registration_open
                  ? new Date(
                      activeCycleConfig.pod_registration_open
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                    })
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

          {/* Up next — dismissible action cards for the currently-open windows */}
          {upNextTodos.length > 0 && <UpNext todos={upNextTodos} />}

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
                        <StatusBadge variant={variant}>{pod.status}</StatusBadge>
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
        </div>

        {/* Right rail — durable utilities */}
        <aside className="flex flex-col gap-6">
          {/* Your commitments — the dated anchor events + .ics, always findable */}
          <CycleCommitments />
          <QuickLinks cycleId={activeCycle?.id} />

          {/* Past cycles — a compact archive, tucked away */}
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
        </aside>
      </div>
    </div>
  );
}
