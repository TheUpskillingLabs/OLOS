import Link from "next/link";
import { BookOpen, ArrowRight, ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StatCard, StatusBadge } from "@/app/components/ui";
import FollowButton from "@/app/components/follow-button";
import { isFollowing, getFollowerCount } from "@/lib/follows/queries";
import CycleJourney from "@/app/components/cycle/cycle-journey";
import {
  resolveCycleTimeline,
  type CycleConfigPhaseColumns,
} from "@/lib/cycle/phases";
import { getCycleWeek } from "@/lib/cycle/week";

type CycleStatus = "active" | "upcoming" | "closing" | "archived" | "closed" | "draft";
type PodStatus = "active" | "forming" | "closed" | "inactive";

const CYCLE_STATUS_VARIANT: Record<
  CycleStatus,
  "active" | "forming" | "inactive" | "draft"
> = {
  active: "active",
  upcoming: "forming",
  closing: "active",
  archived: "inactive",
  closed: "inactive",
  draft: "draft",
};

const POD_STATUS_VARIANT: Record<
  PodStatus,
  "active" | "forming" | "inactive"
> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const supabase = await createClient();

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, name, slug, start_date, end_date, status")
    .eq("id", parseInt(cycle_id))
    .single();

  if (!cycle) notFound();

  const { data: pods } = await supabase
    .from("pods")
    .select("id, name, status")
    .eq("cycle_id", cycle.id)
    .order("created_at");

  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select("status")
    .eq("cycle_id", cycle.id);

  const activeCount =
    enrollments?.filter((e) => e.status === "active").length || 0;

  // Fetch active windows
  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select(
      "problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
    )
    .eq("cycle_id", cycle.id)
    .single();

  // The same phase roadmap the dashboard shows — one source, so the two agree.
  const timeline = config
    ? resolveCycleTimeline(config as unknown as CycleConfigPhaseColumns)
    : null;
  const cycleWeek = getCycleWeek(
    new Date(),
    new Date(cycle.start_date),
    new Date(cycle.end_date)
  );
  const podsReady = (pods?.length ?? 0) > 0;

  const cycleStatusVariant =
    CYCLE_STATUS_VARIANT[cycle.status as CycleStatus] ?? "inactive";

  // Resolve the viewer for the follow button + follower count. Counts go through
  // the service client (follows RLS is self-scoped).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewerId: number | null = null;
  if (user) {
    const { data: p } = await serviceClient
      .from("participants")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    viewerId = p?.id ?? null;
  }
  const [cycleFollowing, cycleFollowerCount] = await Promise.all([
    viewerId
      ? isFollowing(serviceClient, viewerId, "cycle", cycle.id)
      : Promise.resolve(false),
    getFollowerCount(serviceClient, "cycle", cycle.id),
  ]);

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/cycles"
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          All cycles
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          {cycle.name}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-meta">
          <span className="tabular-nums">
            {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
            {new Date(cycle.end_date).toLocaleDateString()}
          </span>
          <StatusBadge variant={cycleStatusVariant}>{cycle.status}</StatusBadge>
        </div>
        {viewerId && (
          <div className="mt-3">
            <FollowButton
              targetType="cycle"
              targetId={cycle.id}
              initialFollowing={cycleFollowing}
              initialCount={cycleFollowerCount}
              showCount
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Where you are in the cycle — the same roadmap the dashboard shows. */}
      {timeline && (
        <CycleJourney
          cycleId={cycle.id}
          timeline={timeline}
          week={cycleWeek}
          podsReady={podsReady}
        />
      )}

      {/* Learning Log — the weekly practice, framed calmly (it replaced the pulse check) */}
      {cycle.status === "active" && (
        <div className="mb-8">
          <Link
            href="/dashboard#learning-log"
            className="group flex items-center justify-between gap-3 rounded-card border border-ink/10 border-l-4 border-l-teal bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3">
              <BookOpen
                className="h-5 w-5 flex-shrink-0 text-teal-deep"
                aria-hidden
              />
              <div>
                <span className="font-semibold tracking-tight text-ink">
                  Your weekly Learning Log
                </span>
                <p className="mt-0.5 text-sm text-meta">
                  A few lines each week on what you&apos;re figuring out. That&apos;s
                  the check-in that keeps you in the cycle.
                </p>
              </div>
            </div>
            <ArrowRight
              className="h-4 w-4 flex-shrink-0 text-teal-deep transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
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
          <h2 className="t-h3 mb-4 text-ink">
            Pods
          </h2>
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
