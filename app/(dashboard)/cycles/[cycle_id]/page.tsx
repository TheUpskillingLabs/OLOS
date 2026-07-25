import Link from "next/link";
import { registrationWindow } from "@/lib/cycles/schedule";
import {
  windowOpen,
  fmtLabDate,
  fmtLabDateTime,
  parseWindow,
} from "@/lib/cycles/lab-time";
import {
  BookOpen,
  ArrowRight,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  FolderKanban,
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StatCard, StatusBadge } from "@/app/components/ui";
import { cycleInfoContent } from "@/lib/cycles/info";
import { getFieldSurveyForCycle } from "@/lib/content/surveys";

type CycleStatus = "active" | "closed" | "draft";
// Matches pods_status_check (00063): forming/active/inactive/dissolved.
type PodStatus = "active" | "forming" | "inactive" | "dissolved";

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
  inactive: "inactive",
  dissolved: "inactive",
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
    .select("id, name, slug, start_date, end_date, status, sector_id, mode")
    .eq("id", parseInt(cycle_id))
    .single();

  if (!cycle) notFound();

  // The cycle's open field survey (cycle-tied, else sector commons) — same
  // resolution the dashboard uses for the member's first CTA.
  const fieldSurvey = await getFieldSurveyForCycle(
    cycle.id,
    cycle.sector_id ?? null
  );

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase
        .from("participants")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  // Register CTA (July 2026 feedback, running-list #1): the join flow accepts
  // active and upcoming cohorts, but this page had no way into it. Shown only
  // to signed-in members who haven't signed this cycle's agreement, while the
  // D-10 registration window is open. Org cycles are invite-only — never a
  // Register CTA.
  let showRegisterCta = false;
  if (
    me &&
    cycle.mode !== "org" &&
    (cycle.status === "active" || cycle.status === "upcoming")
  ) {
    const { data: agreement } = await serviceClient
      .from("cycle_agreements")
      .select("id")
      .eq("cycle_id", cycle.id)
      .eq("participant_id", me.id)
      .maybeSingle();
    if (!agreement) {
      showRegisterCta = (await registrationWindow(serviceClient, cycle.id))
        .open;
    }
  }

  // The viewer's own problem statements (July 2026 feedback, running-list #2):
  // before this, statements were only ever listed on the vote ballot during
  // the voting phase, so a submitter had no way to see their own submission
  // back. Deliberately a direct owner-scoped query, not the shared GET route —
  // that route's per-lab filter shapes the ballot and stays untouched.
  const { data: myStatements } = me
    ? await serviceClient
        .from("problem_statements")
        .select("id, statement_text, proposal_data, created_at")
        .eq("cycle_id", cycle.id)
        .eq("participant_id", me.id)
        .order("created_at")
    : { data: null };

  // Door to the proposal gallery — shown as soon as the cycle has any
  // statements at all (the gallery page itself applies the per-lab filter).
  const { count: statementCount } = await serviceClient
    .from("problem_statements")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", cycle.id);

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

  // The seam between voting and pod registration is the one quiet stretch
  // where the page would otherwise go silent mid-arc: votes are in, pods
  // aren't announced. Say what's happening rather than showing nothing.
  let interlude: string | null = null;
  if (config && activeWindows.length === 0) {
    const cfg = config as Record<string, string | null>;
    const votingClosed =
      cfg.voting_close && now > (parseWindow(cfg.voting_close) as Date);
    const podRegStarted =
      cfg.pod_registration_open &&
      now > (parseWindow(cfg.pod_registration_open) as Date);
    if (votingClosed && !podRegStarted) {
      interlude = cfg.pod_registration_open
        ? `Voting has closed — the shortlist is being finalized. Pod registration opens ${fmtLabDateTime(cfg.pod_registration_open)}.`
        : "Voting has closed — the shortlist is being finalized. Pod registration opens next.";
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

      {/* Register CTA — only while the D-10 window is open and the viewer
          hasn't signed this cycle's agreement yet */}
      {showRegisterCta && (
        <Link
          href={`/cycles/${cycle.id}/join`}
          className="group mb-8 flex items-center justify-between gap-3 rounded-card border border-teal/30 bg-teal/10 p-5 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          <div>
            <span className="font-semibold tracking-tight text-ink">
              Registration is open
            </span>
            <p className="mt-0.5 text-sm text-meta">
              {cycle.status === "active"
                ? "This cycle is running — complete the short registration to join it."
                : "Pre-register now to claim your spot for this cycle."}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-teal-deep">
            Register
            <ArrowRight
              className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </Link>
      )}

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

      {interlude && (
        <div className="mb-8 rounded-card border border-ink/10 bg-white p-4 shadow-card">
          <p className="text-sm text-charcoal">{interlude}</p>
        </div>
      )}

      {/* Insights survey — explainer + two doors: contribute an observation,
          or read what the field has said so far (the results page is every
          participant's window into the observation bedrock the cycle's
          sensemaking runs on). */}
      {fieldSurvey && (
        <div className="mb-8 rounded-card border border-ink/10 border-l-4 border-l-teal bg-white p-4 shadow-card">
          <div className="flex items-center gap-3">
            <ClipboardList
              className="h-5 w-5 flex-shrink-0 text-teal-deep"
              aria-hidden
            />
            <div>
              <span className="font-semibold tracking-tight text-ink">
                Insights survey: {fieldSurvey.title}
              </span>
              <p className="mt-0.5 text-sm text-meta">
                A short, open survey for anyone close to this cycle&apos;s
                theme. First-hand observations are how we make sure pods work
                on real problems, not assumptions — take it, then share it
                with a friend.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 pl-8">
            <Link
              href={`/survey/${fieldSurvey.share_slug}`}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-teal-deep hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              Take the survey
              <ArrowRight
                className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href={`/survey/${fieldSurvey.share_slug}/results`}
              className="inline-flex items-center text-sm font-semibold text-teal-deep hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              See what the field is saying
            </Link>
          </div>
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

      {/* Proposal gallery — browsable in every phase, unlike the ballot,
          which only renders while the voting window is open */}
      {(statementCount ?? 0) > 0 && (
        <div className="mb-8">
          <Link
            href={`/cycles/${cycle.id}/proposals`}
            className="group flex items-center justify-between gap-3 rounded-card border border-ink/10 border-l-4 border-l-teal bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-3">
              <FolderKanban
                className="h-5 w-5 flex-shrink-0 text-teal-deep"
                aria-hidden
              />
              <div>
                <span className="font-semibold tracking-tight text-ink">
                  Problem statement gallery
                </span>
                <p className="mt-0.5 text-sm text-meta">
                  Browse what your cohort is proposing this cycle — with links
                  to the maps behind each statement.
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

      {/* The viewer's own submissions — visible in every phase, not just on
          the voting ballot */}
      {myStatements && myStatements.length > 0 && (
        <div className="mb-8">
          <h2 className="t-h3 mb-4 text-ink">Your problem statements</h2>
          <div className="space-y-3">
            {myStatements.map((s) => {
              // Scheme-checked before rendering as an href (rows can predate
              // the schema's http(s) restriction on repo_url).
              const rawRepo = (
                s.proposal_data as {
                  statement?: { repo_url?: string };
                } | null
              )?.statement?.repo_url;
              const mapUrl =
                rawRepo && /^https?:\/\//i.test(rawRepo) ? rawRepo : null;
              return (
                <blockquote
                  key={s.id}
                  className="rounded-card border border-ink/10 bg-white p-4 shadow-card"
                >
                  <p className="text-sm leading-relaxed text-charcoal">
                    {s.statement_text}
                  </p>
                  <p className="mt-2 text-xs text-meta">
                    Submitted {new Date(s.created_at).toLocaleDateString()}
                  </p>
                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:underline focus-visible:underline"
                    >
                      View your map
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </blockquote>
              );
            })}
          </div>
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
