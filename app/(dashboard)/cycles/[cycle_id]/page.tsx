import Link from "next/link";
import { ArrowRight, ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/app/components/ui";
import { openWindows } from "@/lib/cycle/windows";
import { isOperatingCycle } from "@/lib/cycle/active";
import { formatMonthDay } from "@/lib/format/date";

/* The cycle detail page — the archive/share view for cycles that are NOT the
   member's running Build Cycle (past cohorts, org cycles, drafts). The
   running participant cycle lives on the "My Cycle" hub at /cycles, so this
   route redirects there for it: one canonical page per cycle, and every old
   deep link (/pods, /projects, /c/[id] shares) lands on the personal hub. */

type CycleStatus = "active" | "closed" | "draft";
type PodStatus = "active" | "forming" | "closed" | "inactive";

const CYCLE_STATUS_VARIANT: Record<CycleStatus, "active" | "inactive" | "draft"> = {
  active: "active",
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
    .select("id, name, slug, start_date, end_date, status, mode, lab_id")
    .eq("id", parseInt(cycle_id))
    .single();

  if (!cycle) notFound();

  // The running participant cohort is the My Cycle hub's job.
  if (isOperatingCycle(cycle)) {
    redirect("/cycles");
  }

  const { data: pods } = await supabase
    .from("pods")
    .select("id, name, status")
    .eq("cycle_id", cycle.id)
    .order("created_at");

  // Open action windows — meaningful for org/upcoming cycles; past cycles
  // have none by definition of their dates.
  const serviceClient = createServiceClient();
  const { data: config } = await serviceClient
    .from("cycle_config")
    .select(
      "problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
    )
    .eq("cycle_id", cycle.id)
    .single();

  const activeWindows = config ? openWindows(config, new Date()) : [];

  const cycleStatusVariant =
    CYCLE_STATUS_VARIANT[cycle.status as CycleStatus] ?? "inactive";

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/cycles"
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          My Cycle
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
                  {w.action}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate">
                <span className="tabular-nums">
                  closes {formatMonthDay(w.closesAt)}
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
