import Link from "next/link";
import { Activity, ArrowRight, ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StatCard, StatusBadge } from "@/app/components/ui";
import { cycleStatusVariant, cycleStatusLabel } from "@/lib/cycles/status";
import { isCycleOpenForRegistration } from "@/lib/cycles/registration";
import { CycleInfo } from "@/app/components/cycle/cycle-info";

type PodStatus = "active" | "forming" | "closed" | "inactive";

const POD_STATUS_VARIANT: Record<
  PodStatus,
  "active" | "forming" | "inactive"
> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

const WINDOW_ROUTES: {
  label: string;
  field: string;
  route: string;
}[] = [
  { label: "Submit Problem Statements", field: "problem_statement", route: "propose" },
  { label: "Vote on Problem Statements", field: "voting", route: "vote" },
  { label: "Register for Pods", field: "pod_registration", route: "register-pods" },
  { label: "Submit Solution Proposals", field: "solution_proposal", route: "solutions" },
  { label: "Vote on Solutions", field: "solution_voting", route: "solution-vote" },
  { label: "Register for Projects", field: "project_registration", route: "register-projects" },
];

function BackLink() {
  return (
    <Link
      href="/cycles"
      className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      All cycles
    </Link>
  );
}

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const cycleId = parseInt(cycle_id);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const serviceClient = createServiceClient();

  const { data: cycle } = await serviceClient
    .from("cycles")
    .select(
      "id, name, slug, start_date, end_date, status, description, what_you_build"
    )
    .eq("id", cycleId)
    .single();

  if (!cycle) notFound();

  // Is the current user already enrolled in this cycle?
  let isEnrolled = false;
  if (user) {
    const { data: participant } = await serviceClient
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (participant) {
      const { data: enr } = await serviceClient
        .from("cycle_enrollments")
        .select("id")
        .eq("participant_id", participant.id)
        .eq("cycle_id", cycle.id)
        .maybeSingle();
      isEnrolled = !!enr;
    }
  }

  // Not enrolled → the information overview + a Register CTA (when the cycle is
  // active or open for registration).
  if (!isEnrolled) {
    const joinable =
      cycle.status === "active" ||
      (await isCycleOpenForRegistration(serviceClient, cycle.id));
    return (
      <div>
        <div className="mb-8">
          <BackLink />
        </div>
        <CycleInfo
          cycle={cycle}
          cta={
            joinable ? (
              <Link
                href={`/cycles/${cycle.id}/join`}
                className="btn btn-teal btn-block"
              >
                Register for {cycle.name}
              </Link>
            ) : (
              <p className="text-sm text-meta">
                Registration isn&rsquo;t open for this cycle right now.
              </p>
            )
          }
        />
      </div>
    );
  }

  // Enrolled → the member detail view.
  const { data: pods } = await serviceClient
    .from("pods")
    .select("id, name, status")
    .eq("cycle_id", cycle.id)
    .order("created_at");

  const { data: enrollments } = await serviceClient
    .from("cycle_enrollments")
    .select("status")
    .eq("cycle_id", cycle.id);

  const activeCount =
    enrollments?.filter((e) => e.status === "active").length || 0;

  const { data: config } = await serviceClient
    .from("cycle_config")
    .select(
      "problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
    )
    .eq("cycle_id", cycle.id)
    .single();

  const now = new Date();
  const activeWindows: { label: string; route: string; closesAt: string }[] = [];
  if (config) {
    for (const w of WINDOW_ROUTES) {
      const configRecord = config as Record<string, string | null>;
      const openVal = configRecord[`${w.field}_open`];
      const closeVal = configRecord[`${w.field}_close`];
      if (openVal && closeVal && now >= new Date(openVal) && now <= new Date(closeVal)) {
        activeWindows.push({ label: w.label, route: w.route, closesAt: closeVal });
      }
    }
  }

  return (
    <div>
      <div className="mb-8">
        <BackLink />
        <h1 className="t-h1 mt-2 text-ink">{cycle.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-meta">
          <span className="tabular-nums">
            {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
            {new Date(cycle.end_date).toLocaleDateString()}
          </span>
          <StatusBadge variant={cycleStatusVariant(cycle.status)}>
            {cycleStatusLabel(cycle.status)}
          </StatusBadge>
        </div>
      </div>

      {/* Active window CTAs */}
      {activeWindows.length > 0 && (
        <div className="mb-8 space-y-3">
          {activeWindows.map((w) => (
            <Link
              key={w.route}
              href={`/cycles/${cycle.id}/${w.route}`}
              className="group flex items-center justify-between gap-3 rounded-card border border-teal/30 bg-teal/10 p-4 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
                </span>
                <span className="font-semibold tracking-tight text-ink">
                  {w.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate">
                <span className="tabular-nums">
                  closes{" "}
                  {new Date(w.closesAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <ArrowRight
                  className="h-4 w-4 text-teal-deep transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                  aria-hidden
                />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pulse Check — always-on requirement */}
      {cycle.status === "active" && (
        <div className="mb-8">
          <Link
            href="/pulse-check"
            className="group flex items-center justify-between gap-3 rounded-card border border-ink/10 border-l-4 border-l-red bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 flex-shrink-0 text-red" aria-hidden />
              <div>
                <span className="font-semibold tracking-tight text-ink">
                  Weekly pulse check
                </span>
                <p className="mt-0.5 text-sm text-meta">
                  Complete your weekly check-in to stay active and retain access
                  to GitHub, Google Docs, Slack, and Google Groups.
                </p>
              </div>
            </div>
            <ArrowRight
              className="h-4 w-4 flex-shrink-0 text-red transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total enrolled" value={enrollments?.length || 0} />
        <StatCard
          label="Active"
          value={<span className="text-teal-deep">{activeCount}</span>}
        />
        <StatCard label="Pods" value={pods?.length || 0} />
      </div>

      {pods && pods.length > 0 && (
        <div>
          <h2 className="t-h3 mb-4 text-ink">Pods</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pods.map((pod) => {
              const variant =
                POD_STATUS_VARIANT[pod.status as PodStatus] ?? "inactive";
              return (
                <Link
                  key={pod.id}
                  href={`/pods/${pod.id}`}
                  className="rounded-card border border-ink/10 bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold tracking-tight text-ink">
                      {pod.name || `Pod ${pod.id}`}
                    </span>
                    <StatusBadge variant={variant}>{pod.status}</StatusBadge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
