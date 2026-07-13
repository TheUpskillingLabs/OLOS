import Link from "next/link";
import { windowOpen, fmtLabDate } from "@/lib/cycles/lab-time";
import { BookOpen, ArrowRight, ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StatCard, StatusBadge } from "@/app/components/ui";
import { cycleInfoContent } from "@/lib/cycles/info";

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
      "theme_description, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
    )
    .eq("cycle_id", cycle.id)
    .single();

  // The cycle's theme/explanation copy (cycle_config.theme_description, 00084)
  // — same source + generic fallback as the registration ceremony's theme
  // screen, surfaced on the cycle page below the header.
  const themeDescription = cycleInfoContent({
    theme_description: (config as { theme_description?: string | null } | null)
      ?.theme_description,
  }).themeDescription;

  const now = new Date();
  const activeWindows: { label: string; route: string; closesAt: string }[] = [];
  if (config) {
    for (const w of WINDOW_ROUTES) {
      const configRecord = config as Record<string, string | null>;
      const openVal = configRecord[`${w.field}_open`];
      const closeVal = configRecord[`${w.field}_close`];
      if (openVal && closeVal && windowOpen(openVal, closeVal, now)) {
        activeWindows.push({ label: w.label, route: w.route, closesAt: closeVal });
      }
    }
  }

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
      </div>

      {/* Cycle theme/explanation copy — below the title/dates, above the tiles */}
      {themeDescription && (
        <p
          className="mb-8 max-w-2xl text-charcoal"
          style={{ whiteSpace: "pre-line" }}
        >
          {themeDescription}
        </p>
      )}

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
                  {fmtLabDate(w.closesAt)}
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
