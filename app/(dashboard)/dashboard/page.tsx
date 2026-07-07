import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calendar } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge, EmptyState } from "@/app/components/ui";
import CycleJourney from "@/app/components/cycle/cycle-journey";
import PodJoinSection from "./pod-join-section";
import LearningLogCard, { type MilestoneContext } from "./learning-log-card";
import { getCycleWeek } from "@/lib/cycle/week";
import {
  resolveCycleTimeline,
  type CycleConfigPhaseColumns,
} from "@/lib/cycle/phases";
import {
  milestoneKindForWeek,
  milestoneLabel,
  type MilestoneWeeks,
} from "@/lib/cycle/milestones";
import SetupChecklist, { type ChecklistItem } from "./setup-checklist";
import CycleCommitments from "./cycle-commitments";
import DashboardHero, { type HeroStat } from "./dashboard-hero";
import QuickLinks from "./quick-links";
import { learningLogGate } from "@/lib/learning-logs/gate";

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
    serviceClient.from("cycles").select("id, name, slug, start_date, end_date, status").order("start_date", { ascending: false }),
  ]);

  if (!participant) redirect("/register");

  const activeCycle = cycles?.find((c) => c.status === "active") ?? null;

  // The cohort a not-yet-enrolled member registers for: the newest cycle open
  // for pre-registration (`upcoming`), if any. Mirrors getRecruitingCycle
  // (lib/cycle/active.ts) — the signup funnel and the confirmation email
  // already point new members at this cohort, so the dashboard's join CTA has
  // to as well, or a member who signed up for the upcoming cohort lands here
  // with no path to it. `cycles` is ordered start_date desc → the first match
  // is the newest upcoming.
  const upcomingCycle = cycles?.find((c) => c.status === "upcoming") ?? null;

  type PodMembership = { id: number; pod_id: number; pods: { id: number; name: string; status: string } };
  let activeCycleConfig = null;
  let enrollment = null;
  let myPods: PodMembership[] = [];

  let hasAgreement = false;
  let logCount = 0;
  let podsExist = false;

  if (activeCycle) {
    const [
      configResult,
      enrollmentResult,
      membershipResult,
      agreementResult,
      logResult,
      podsResult,
    ] = await Promise.all([
        serviceClient
          .from("cycle_config")
          .select(
            "phase_2_start, phase_3_start, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close, pod_limit, milestone_mid_week, milestone_final_week"
          )
          .eq("cycle_id", activeCycle.id)
          .single(),
        serviceClient
          .from("cycle_enrollments")
          .select("id, status")
          .eq("participant_id", participant.id)
          .eq("cycle_id", activeCycle.id)
          .maybeSingle(),
        serviceClient
          .from("pod_memberships")
          .select("id, pod_id, pods!inner(id, name, status)")
          .eq("participant_id", participant.id)
          .eq("pods.cycle_id", activeCycle.id)
          .is("inactive_at", null),
        serviceClient
          .from("cycle_agreements")
          .select("id", { head: true, count: "exact" })
          .eq("participant_id", participant.id)
          .eq("cycle_id", activeCycle.id),
        serviceClient
          .from("learning_logs")
          .select("id", { head: true, count: "exact" })
          .eq("participant_id", participant.id),
        // Do any pods exist yet for this cycle? Pods are only created when an
        // admin finalizes problem-statement voting — before that, "join a pod"
        // is not a real action no matter what the window says.
        serviceClient
          .from("pods")
          .select("id", { head: true, count: "exact" })
          .eq("cycle_id", activeCycle.id)
          .in("status", ["forming", "active"]),
      ]);
    activeCycleConfig = configResult.data;
    enrollment = enrollmentResult.data;
    myPods = (membershipResult.data as unknown as PodMembership[]) ?? [];
    hasAgreement = (agreementResult.count ?? 0) > 0;
    logCount = logResult.count ?? 0;
    podsExist = (podsResult.count ?? 0) > 0;
  }

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

  // Canonical phase timeline (lib/cycle/phases.ts) — one source for the journey,
  // the enrollment state machine, and the Up-Next cards.
  const timeline = activeCycleConfig
    ? resolveCycleTimeline(activeCycleConfig as unknown as CycleConfigPhaseColumns)
    : null;
  const podWindowOpen =
    timeline?.phases.find((p) => p.field === "pod_registration")?.state === "open";
  const cycleWeek = activeCycle
    ? getCycleWeek(
        new Date(),
        new Date(activeCycle.start_date),
        new Date(activeCycle.end_date)
      )
    : -1;

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
  const logGate = await learningLogGate(participant.id);

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
    // The Learning Log is available from day one, so it's a real checklist item.
    // Phase actions (join a pod, propose, vote…) are deliberately NOT here: they
    // surface via the cycle journey + Up Next only when their window is open and
    // the action actually exists — never as a stale checklist nag.
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

  // Empty state: no enrollment — the onboarding checklist leads, then the join
  // CTA. When the next cohort is open for pre-registration, the CTA points at
  // it (that's where signup routed the member), not the closing active cycle.
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
        {upcomingCycle && !preRegisteredUpcoming && (
          <p className="mb-4 text-sm text-meta">
            {activeCycle.name} is already underway — the next cohort is open for
            registration below.
          </p>
        )}
        {upcomingCycle
          ? preRegisteredUpcoming
            ? preRegisteredCard(upcomingCycle)
            : joinCycleCard(upcomingCycle, true)
          : joinCycleCard(activeCycle, false)}
        <div className="mt-8">{logSectionFor(true)}</div>
      </div>
    );
  }

  // Empty state: no active cycle. If the next cohort is already open for
  // registration, lead with its join CTA instead of the "nothing running" note.
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
        <div className="mt-8">{logSectionFor(true)}</div>
      </div>
    );
  }

  // Engaged state: user has a cycle_enrollments row — full dashboard chrome.
  // (checklistItems is built above the early returns so it renders in every state.)

  // Hero copy + at-a-glance stats — the identity band adapts to the state. The
  // window framing keys off whether ANY action is live (timeline.current), not
  // just the pod window, so the lede can't contradict the journey below it.
  const heroLede = logGate.active
    ? "Your weekly Learning Log is due — save it below and everything unlocks."
    : timeline?.current
      ? "Here's what's happening in your cycle right now — your next step is below."
      : "You're in. We'll surface your next step here the moment it opens.";

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
    podsExist &&
    myPods.length < podLimit;

  return (
    <div>
      <DashboardHero
        initials={initials}
        avatarUrl={avatarUrl}
        eyebrow={activeCycle?.name ?? "Member portal"}
        greeting={`Welcome back, ${displayName}`}
        lede={heroLede}
        stats={heroStats.length > 0 ? heroStats : undefined}
      />

      {/* Two-column working layout: the main column carries what to do now;
          the right rail carries the durable utilities (LinkedIn's rail in
          the light system). Collapses to a single column below 768px. */}
      <div className="dash">
        <div>
          {/* Where you are in the cycle — the six-stage roadmap, so the member
              always knows the current step and what opens next. */}
          {activeCycle && timeline && (
            <CycleJourney
              cycleId={activeCycle.id}
              timeline={timeline}
              week={cycleWeek}
              podsReady={podsExist}
              canAct={enrollment?.status !== "revoked"}
            />
          )}

          {/* Setup leads for a new member; drops off once every item is done. */}
          {checklistItems.length > 0 &&
            !checklistItems.every((i) => i.done) && (
              <SetupChecklist items={checklistItems} />
            )}

          {/* The Learning Log — a personal journaling practice on Home (Phase
              1; replaces the pulse-check CTA). Active cycle members get the
              weekly ritual + gate + pod health check; everyone else journals
              (journal mode). The gate banner + lock apply only inside a cycle. */}
          {logSectionFor(!inActiveCycle)}

          {podRegOpen && activeCycle && (
            <PodJoinSection
              cycleId={activeCycle.id}
              participantId={participant.id}
              myPodIds={myPods.map((m) => m.pod_id)}
              podLimit={podLimit}
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
                        <StatusBadge variant={variant}>{pod.status}</StatusBadge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right rail — durable utilities */}
        <aside className="flex flex-col gap-6">
          {/* Your commitments — the dated anchor events + .ics, always findable */}
          <CycleCommitments />
          <QuickLinks cycleId={activeCycle?.id} logDue={logGate.active} />

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
