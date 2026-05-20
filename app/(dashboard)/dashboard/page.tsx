import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Calendar } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge, EmptyState } from "@/app/components/ui";
import CyclePhaseIndicator from "../cycles/cycle-phase-indicator";
import PodJoinSection from "./pod-join-section";

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

  // Check participant exists
  const { data: participant } = await serviceClient
    .from("participants")
    .select("id, preferred_name, first_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!participant) redirect("/register");

  // Fetch all cycles
  const { data: cycles } = await serviceClient
    .from("cycles")
    .select("id, name, slug, start_date, end_date, status")
    .order("start_date", { ascending: false });

  const activeCycle = cycles?.find((c) => c.status === "active") ?? null;

  // Fetch config for active cycle (phase indicator + window checks)
  let activeCycleConfig = null;
  if (activeCycle) {
    const { data } = await serviceClient
      .from("cycle_config")
      .select(
        "phase_2_start, phase_3_start, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
      )
      .eq("cycle_id", activeCycle.id)
      .single();
    activeCycleConfig = data;
  }

  // Fetch user's enrollment for active cycle
  let enrollment = null;
  if (activeCycle) {
    const { data } = await serviceClient
      .from("cycle_enrollments")
      .select("id, status")
      .eq("participant_id", participant.id)
      .eq("cycle_id", activeCycle.id)
      .maybeSingle();
    enrollment = data;
  }

  // Fetch user's pod memberships for active cycle
  type PodMembership = { id: number; pod_id: number; pods: { id: number; name: string; status: string } };
  let myPods: PodMembership[] = [];
  if (activeCycle) {
    const { data } = await serviceClient
      .from("pod_memberships")
      .select("id, pod_id, pods!inner(id, name, status)")
      .eq("participant_id", participant.id)
      .is("inactive_at", null);

    // Filter to pods in the active cycle
    if (data) {
      const { data: cyclePods } = await serviceClient
        .from("pods")
        .select("id")
        .eq("cycle_id", activeCycle.id);
      const cyclePodIds = new Set(cyclePods?.map((p) => p.id) ?? []);
      myPods = (data as unknown as PodMembership[]).filter((m) => cyclePodIds.has(m.pod_id));
    }
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

  let state: DashboardState = "no_cycle";
  if (activeCycle) {
    if (!enrollment) {
      state = "no_enrollment";
    } else if (enrollment.status === "active") {
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
        <h1 className="mb-8 text-2xl font-bold tracking-tight text-white">
          Welcome, {displayName}.
        </h1>
        <Link
          href={`/cycles/${activeCycle.id}/join`}
          className="group flex items-center justify-between rounded-lg border border-teal/20 bg-teal/[0.04] p-8 transition-colors duration-150 ease-out hover:border-teal/40 hover:bg-teal/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-white">
              {activeCycle.name}
            </h2>
            <p className="mt-1 text-sm text-cloud/60">
              {new Date(activeCycle.start_date).toLocaleDateString()} &ndash;{" "}
              {new Date(activeCycle.end_date).toLocaleDateString()}
            </p>
            <p className="mt-3 text-sm text-cloud/60">
              Complete this form to join the cycle.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-base font-semibold tracking-tight text-aqua">
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
        <h1 className="mb-8 text-2xl font-bold tracking-tight text-white">
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

  // Engaged state: user has a cycle_enrollments row — full dashboard chrome
  return (
    <div>
      {/* Greeting */}
      <p className="text-sm font-medium uppercase tracking-widest text-cloud/40">
        Your Dashboard
      </p>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">
        Welcome back, {displayName}
      </h1>

      {/* Phase timeline for active cycle */}
      {activeCycle && activeCycleConfig && (
        <CyclePhaseIndicator cycle={activeCycle} config={activeCycleConfig} />
      )}

      {/* Pulse Check CTA — only show when user has an active enrollment */}
      {enrollment?.status === "active" && (
        <Link
          href="/pulse-check"
          className="group mb-6 flex items-center justify-between rounded-md border border-yellow-500/20 bg-yellow-500/[0.04] p-4 transition-colors duration-150 ease-out hover:border-yellow-500/40 hover:bg-yellow-500/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
        >
          <div className="flex items-center gap-3">
            <Activity
              className="h-5 w-5 flex-shrink-0 text-yellow-300"
              aria-hidden
            />
            <div>
              <span className="font-semibold tracking-tight text-white">
                Weekly pulse check
              </span>
              <p className="text-sm text-cloud/60">
                Stay active &mdash; complete your check-in to keep access to
                cycle tools.
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-yellow-300 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}

      {/* Status block */}
      {state === "interest_submitted_window_closed" && activeCycleConfig && (
        <div className="mb-8 rounded-md border border-whisper bg-white/[0.02] p-5">
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Interest submitted
          </h2>
          <p className="mt-1 text-sm text-cloud/60">
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
        activeCycle && (
          <PodJoinSection
            cycleId={activeCycle.id}
            participantId={participant.id}
            myPodIds={myPods.map((m) => m.pod_id)}
          />
        )}

      {/* My Pods */}
      {myPods.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-cloud/60">
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
                  href={`/cycles/${activeCycle!.id}/pods/${pod.id}`}
                  className="rounded-md border border-whisper bg-white/[0.02] p-4 transition-colors duration-150 ease-out hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold tracking-tight text-white">
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
          <summary className="mb-4 cursor-pointer text-sm font-medium uppercase tracking-widest text-cloud/60 hover:text-cloud/80">
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
                  className="rounded-md border border-whisper bg-white/[0.02] p-6 transition-colors duration-150 ease-out hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-tight text-white">
                      {cycle.name}
                    </h3>
                    <StatusBadge variant={variant}>{cycle.status}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-cloud/60">
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
