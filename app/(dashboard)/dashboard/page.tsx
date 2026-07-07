import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Calendar } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { StatusBadge, EmptyState } from "@/app/components/ui";
import {
  cycleStatusVariant,
  cycleStatusLabel,
  isPastCycle,
} from "@/lib/cycles/status";
import { getRegistrationCycle } from "@/lib/cycles/registration";
import CyclePhaseIndicator from "../cycles/cycle-phase-indicator";
import PodJoinSection from "./pod-join-section";

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

  if (activeCycle) {
    const [configResult, enrollmentResult, membershipResult] = await Promise.all([
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
    ]);
    activeCycleConfig = configResult.data;
    enrollment = enrollmentResult.data;
    myPods = (membershipResult.data as unknown as PodMembership[]) ?? [];
  }

  // The cycle currently open for registration (may be `upcoming`, e.g. Civics &
  // Elections) and the user's standing in it — the clearest next step for a new
  // member who isn't yet engaged in the active cycle.
  const registrationCycle = await getRegistrationCycle(serviceClient);
  const showRegistration =
    !!registrationCycle && registrationCycle.id !== activeCycle?.id;
  let registrationEnrollment: { id: number; status: string } | null = null;
  if (showRegistration && registrationCycle) {
    const { data } = await serviceClient
      .from("cycle_enrollments")
      .select("id, status")
      .eq("participant_id", participant.id)
      .eq("cycle_id", registrationCycle.id)
      .maybeSingle();
    registrationEnrollment = data;
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
    } else if (enrollment.status === "active" || myPods.length > 0) {
      state = "active";
    } else if (podWindowOpen) {
      state = "interest_submitted_window_open";
    } else {
      state = "interest_submitted_window_closed";
    }
  }

  // A new member's clearest next step is the cycle open for registration (e.g.
  // Civics & Elections) — feature it instead of an active cycle they're not in,
  // or a bare "no cycle" empty state.
  if (
    (state === "no_enrollment" || state === "no_cycle") &&
    showRegistration &&
    registrationCycle
  ) {
    const enrolled = !!registrationEnrollment;
    const startLong = new Date(registrationCycle.start_date).toLocaleDateString(
      "en-US",
      { month: "long", day: "numeric", year: "numeric" }
    );
    return (
      <div>
        <h1 className="t-h1 mb-8 text-ink">Welcome, {displayName}.</h1>
        <Link
          href={
            enrolled
              ? `/cycles/${registrationCycle.id}`
              : `/cycles/${registrationCycle.id}/join`
          }
          className="group flex items-center justify-between rounded-card border border-teal/30 bg-white p-8 shadow-card transition-colors duration-150 ease-out hover:border-teal hover:bg-teal/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div>
            <div className="lbl lbl-teal mb-2">
              {enrolled ? "You're registered" : "Registration open"}
            </div>
            <h2 className="t-h3 text-ink">{registrationCycle.name}</h2>
            <p className="mt-1 text-sm text-meta">Starts {startLong}</p>
            <p className="mt-3 text-sm text-meta">
              {enrolled
                ? "You're all set — we'll email you when the first steps open."
                : "Register to join this cycle."}
            </p>
          </div>
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-base font-semibold tracking-tight text-teal-deep">
            {enrolled ? "View cycle" : `Register`}
            <ArrowRight
              className="h-5 w-5 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      </div>
    );
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

  // Engaged state: user has a cycle_enrollments row — full dashboard chrome
  return (
    <div>
      {/* Greeting */}
      <p className="lbl">
        Your Dashboard
      </p>
      <h1 className="t-h1 mb-6 text-ink">
        Welcome back, {displayName}
      </h1>

      {/* Registration open for an upcoming cycle — light wayfinding */}
      {showRegistration && registrationCycle && (
        <Link
          href={
            registrationEnrollment
              ? `/cycles/${registrationCycle.id}`
              : `/cycles/${registrationCycle.id}/join`
          }
          className="group mb-6 flex items-center justify-between rounded-card border border-teal/30 bg-teal/[0.06] p-4 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div>
            <span className="font-semibold tracking-tight text-ink">
              {registrationEnrollment
                ? `You're registered for ${registrationCycle.name}`
                : `Registration is open for ${registrationCycle.name}`}
            </span>
            <p className="text-sm text-meta">
              Starts{" "}
              {new Date(registrationCycle.start_date).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" }
              )}
            </p>
          </div>
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-sm font-semibold tracking-tight text-teal-deep">
            {registrationEnrollment ? "View cycle" : "Register"}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      )}

      {/* Phase timeline for active cycle */}
      {activeCycle && activeCycleConfig && (
        <CyclePhaseIndicator cycle={activeCycle} config={activeCycleConfig} />
      )}

      {/* Pulse Check CTA — show when user is active (has pods or active enrollment) */}
      {state === "active" && (
        <Link
          href="/pulse-check"
          className="gate-banner group mb-6 flex items-center justify-between transition-colors duration-150 ease-out hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-3">
            <Activity
              className="h-5 w-5 flex-shrink-0 text-red"
              aria-hidden
            />
            <div>
              <span className="font-semibold tracking-tight text-ink">
                Weekly pulse check
              </span>
              <p className="text-sm text-meta">
                Stay active &mdash; complete your check-in to keep access to
                cycle tools.
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-4 w-4 flex-shrink-0 text-red transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      )}

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
            . We&rsquo;ll let you know when it&rsquo;s time to choose your pods.
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

      {/* Past cycles — genuinely finished only */}
      {otherCycles.filter((c) => isPastCycle(c.status)).length > 0 && (
        <details className="mb-8">
          <summary className="lbl mb-4 cursor-pointer hover:text-charcoal">
            Past cycles
          </summary>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherCycles
              .filter((c) => isPastCycle(c.status))
              .map((cycle) => (
                <Link
                  key={cycle.id}
                  href={`/cycles/${cycle.id}`}
                  className="rounded-card border border-ink/10 bg-white p-6 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="t-h4 text-ink">{cycle.name}</h3>
                    <StatusBadge variant={cycleStatusVariant(cycle.status)}>
                      {cycleStatusLabel(cycle.status)}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-meta">
                    {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
                    {new Date(cycle.end_date).toLocaleDateString()}
                  </p>
                </Link>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
