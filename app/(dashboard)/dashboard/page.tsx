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
    serviceClient.from("participants").select("id, preferred_name, first_name, last_name, profile_image_url").eq("auth_user_id", user.id).maybeSingle(),
    serviceClient.from("cycles").select("id, name, slug, start_date, end_date, status").order("start_date", { ascending: false }),
  ]);

  if (!participant) redirect("/register");

  const activeCycle = cycles?.find((c) => c.status === "active") ?? null;

  type PodMembership = { id: number; pod_id: number; pods: { id: number; name: string; status: string } };
  let activeCycleConfig = null;
  let enrollment = null;
  let myPods: PodMembership[] = [];

  let hasAgreement = false;
  let logCount = 0;

  if (activeCycle) {
    const [configResult, enrollmentResult, membershipResult, agreementResult, logResult] =
      await Promise.all([
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
      ]);
    activeCycleConfig = configResult.data;
    enrollment = enrollmentResult.data;
    myPods = (membershipResult.data as unknown as PodMembership[]) ?? [];
    hasAgreement = (agreementResult.count ?? 0) > 0;
    logCount = logResult.count ?? 0;
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

  const otherCycles =
    cycles?.filter((c) => c.id !== activeCycle?.id) ?? [];

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

  // Empty state: no enrollment — the hero + a single join CTA card.
  if (state === "no_enrollment" && activeCycle) {
    return (
      <div>
        <DashboardHero
          initials={initials}
          avatarUrl={avatarUrl}
          eyebrow="Member portal"
          greeting={`Welcome, ${displayName}`}
          lede="You're almost in. Join the current Build Cycle to get started."
        />
        <Link
          href={`/cycles/${activeCycle.id}/join`}
          className="group flex items-center justify-between rounded-card border border-teal/30 bg-white p-8 shadow-card transition-colors duration-150 ease-out hover:border-teal hover:bg-teal/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div>
            <h2 className="t-h3 text-ink">
              {activeCycle.name}
            </h2>
            <p className="mt-1 text-sm text-meta">
              {new Date(activeCycle.start_date).toLocaleDateString()} &ndash;{" "}
              {new Date(activeCycle.end_date).toLocaleDateString()}
            </p>
            <p className="mt-3 text-sm text-meta">
              Complete this form to join the cycle.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-base font-semibold tracking-tight text-teal-deep">
            Join {activeCycle.name}
            <ArrowRight
              className="h-5 w-5 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      </div>
    );
  }

  // Empty state: no active cycle at all
  if (state === "no_cycle") {
    return (
      <div>
        <DashboardHero
          initials={initials}
          avatarUrl={avatarUrl}
          eyebrow="Member portal"
          greeting={`Welcome, ${displayName}`}
          lede="Here's your home base at The Labs. The next Build Cycle will show up right here."
        />
        <EmptyState
          icon={Calendar}
          title="No cycle running right now"
          description="Check back soon for the next Build Cycle."
        />
      </div>
    );
  }

  // Engaged state: user has a cycle_enrollments row — full dashboard chrome.

  // Setup checklist — actionable rows, collapses to a strip once done
  // (prototype panel-dashboard: checklist first).
  const checklistItems: ChecklistItem[] = activeCycle
    ? [
        {
          key: "profile",
          label: "Complete your profile",
          done: true,
          href: "/profile/edit",
          cta: "Edit",
        },
        {
          key: "register",
          label: `Register for ${activeCycle.name}`,
          done: hasAgreement || enrollment?.status === "active",
          href: `/cycles/${activeCycle.id}/join`,
          cta: "Register",
        },
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
    : [];

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

          {/* The weekly Learning Log — the ritual lives on Home (Phase 1;
              replaces the pulse-check CTA). The gate banner explains the lock;
              saving a log below clears it instantly. */}
          {state === "active" && (
            <section className="mb-8" id="learning-log">
              <div className="mb-4">
                <div className="lbl lbl-teal mb-1.5">Weekly practice</div>
                <h2 className="t-h3 text-ink">Your Learning Log</h2>
              </div>
              {logGate.active && (
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
              <LearningLogCard gateActive={logGate.active} milestone={milestoneCtx} />
            </section>
          )}

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
