import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Calendar } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge, EmptyState } from "@/app/components/ui";
import CyclePhaseIndicator from "../cycles/cycle-phase-indicator";
import PodJoinSection from "./pod-join-section";
import LearningLogCard from "./learning-log-card";
import SetupChecklist, { type ChecklistItem } from "./setup-checklist";
import CycleCommitments from "./cycle-commitments";
import UpNext, { type TodoCard } from "./up-next";
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
    serviceClient.from("participants").select("id, preferred_name, first_name").eq("auth_user_id", user.id).maybeSingle(),
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
            "phase_2_start, phase_3_start, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
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

  // Determine enrollment state for active cycle
  type DashboardState =
    | "no_cycle"
    | "no_enrollment"
    | "interest_submitted_window_closed"
    | "interest_submitted_window_open"
    | "active";

  // The weekly Learning Log gate (fixed window — lib/learning-logs/gate.ts).
  const logGate = await learningLogGate(participant.id);

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

  // Empty state: no enrollment — minimal page with just welcome + hero card
  if (state === "no_enrollment" && activeCycle) {
    return (
      <div>
        <h1 className="t-h1 mb-8 text-ink">
          Welcome, {displayName}.
        </h1>
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
        <h1 className="t-h1 mb-8 text-ink">
          Welcome, {displayName}.
        </h1>
        <EmptyState
          icon={Calendar}
          title="No cycle running right now"
          description="Check back soon for the next build cycle."
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
    { k: "pod_registration", title: "Register for a pod", cta: "Choose pods", sub: "register-pods" },
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

  return (
    <div>
      {/* Greeting */}
      <p className="lbl">
        Your Dashboard
      </p>
      <h1 className="t-h1 mb-6 text-ink">
        Welcome back, {displayName}
      </h1>

      {/* Setup checklist first (prototype order) */}
      {checklistItems.length > 0 && <SetupChecklist items={checklistItems} />}

      {/* Phase timeline for active cycle */}
      {activeCycle && activeCycleConfig && (
        <CyclePhaseIndicator cycle={activeCycle} config={activeCycleConfig} />
      )}

      {/* The weekly Learning Log — the ritual lives on Home (Phase 1;
          replaces the pulse-check CTA). The gate banner explains the lock;
          saving a log below clears it instantly. */}
      {state === "active" && (
        <>
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
          <LearningLogCard gateActive={logGate.active} />
        </>
      )}

      {/* Your commitments — the dated anchor events + .ics, always findable */}
      <CycleCommitments />

      {/* Up next — dismissible action cards for the currently-open windows */}
      {upNextTodos.length > 0 && <UpNext todos={upNextTodos} />}

      {/* Status block */}
      {state === "interest_submitted_window_closed" && activeCycleConfig && (
        <div className="mb-8 rounded-card border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="t-h3 text-ink">
            Interest submitted
          </h2>
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
            . We'll let you know when it's time to choose your pods.
          </p>
        </div>
      )}

      {(state === "interest_submitted_window_open" || state === "active") &&
        activeCycle &&
        podWindowOpen &&
        myPods.length < 2 && (
          <PodJoinSection
            cycleId={activeCycle.id}
            participantId={participant.id}
            myPodIds={myPods.map((m) => m.pod_id)}
          />
        )}

      {/* My Pods */}
      {myPods.length > 0 && (
        <div className="mb-8">
          <h2 className="lbl mb-4">
            My Pods
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    <h3 className="t-h4 text-ink">
                      {pod.name}
                    </h3>
                    <StatusBadge variant={variant}>{pod.status}</StatusBadge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Past cycles */}
      {otherCycles.length > 0 && (
        <details className="mb-8">
          <summary className="lbl mb-4 cursor-pointer hover:text-charcoal">
            Past cycles
          </summary>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCycles.map((cycle) => {
              const variant =
                STATUS_VARIANT[cycle.status as CycleStatus] ?? "inactive";
              return (
                <Link
                  key={cycle.id}
                  href={`/cycles/${cycle.id}`}
                  className="rounded-card border border-ink/10 bg-white p-6 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="t-h4 text-ink">
                      {cycle.name}
                    </h3>
                    <StatusBadge variant={variant}>{cycle.status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-meta">
                    {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                    {new Date(cycle.end_date).toLocaleDateString()}
                  </p>
                </Link>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
