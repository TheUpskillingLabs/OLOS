import Link from "next/link";
import { registrationWindow } from "@/lib/cycles/schedule";
import { fmtDateOnly, parseWindow } from "@/lib/cycles/lab-time";
import {
  BookOpen,
  ChevronLeft,
  ExternalLink,
} from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StatCard, StatusBadge } from "@/app/components/ui";
import { TaskRow } from "@/app/components/tasks";
import { cycleInfoContent } from "@/lib/cycles/info";
import { resolveWindowStates, windowDef } from "@/lib/cycles/windows";

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

  // Window state: phases-first via the canonical registry resolver — the
  // same decision procedure the write gate (checkWindow) uses, so a row
  // shown "open" here can never 403 on submit.
  const serviceClient = createServiceClient();
  const [{ data: config }, { data: phases }] = await Promise.all([
    serviceClient
      .from("cycle_config")
      .select(
        "theme_description, problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close"
      )
      .eq("cycle_id", cycle.id)
      .single(),
    serviceClient
      .from("cycle_phases")
      .select("phase_key, starts_at, ends_at")
      .eq("cycle_id", cycle.id),
  ]);

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

  // The viewer's own problem situations (July 2026 feedback, running-list #2):
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

  const now = new Date();
  // Windows resolved through the canonical registry — one label set
  // (labels.action) shared verbatim with the dashboard's task cards.
  const windowStates =
    cycle.mode !== "org"
      ? resolveWindowStates(
          phases && phases.length > 0 ? phases : null,
          (config ?? null) as Record<string, string | null> | null,
          now
        )
      : [];
  const openWindows = windowStates.filter((s) => s.open);

  // The seam between voting and pod registration is the one quiet stretch
  // where the page would otherwise go silent mid-arc: votes are in, pods
  // aren't announced. Say what's happening rather than showing nothing —
  // an upcoming-state row for pod registration.
  let interlude: { opensAt: string | null } | null = null;
  if (openWindows.length === 0 && windowStates.length > 0) {
    const voting = windowStates.find((s) => s.key === "voting");
    const podReg = windowStates.find((s) => s.key === "pod_registration");
    const votingClose = parseWindow(voting?.closesAt);
    const podRegOpen = parseWindow(podReg?.opensAt);
    const votingClosed = !!votingClose && now > votingClose;
    const podRegStarted = !!podRegOpen && now > podRegOpen;
    if (votingClosed && !podRegStarted) {
      interlude = { opensAt: podReg?.opensAt ?? null };
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
            {fmtDateOnly(cycle.start_date)} &ndash;{" "}
            {fmtDateOnly(cycle.end_date)}
          </span>
          <StatusBadge variant={cycleStatusVariant}>{cycle.status}</StatusBadge>
        </div>
      </div>

      {/* Register CTA — only while the D-10 window is open and the viewer
          hasn't signed this cycle's agreement yet */}
      {showRegisterCta && (
        <div className="mb-8">
          <TaskRow
            state="open"
            title="Registration is open"
            detail={
              cycle.status === "active"
                ? "This cycle is running — complete the short registration to join it."
                : "Pre-register now to claim your spot for this cycle."
            }
            href={`/cycles/${cycle.id}/join`}
          />
        </div>
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

      {/* Open windows — the cycle's state, in the shared row grammar (never
          dismissible; same labels.action strings as the dashboard's cards) */}
      {openWindows.length > 0 && (
        <div className="mb-8">
          <h2 className="lbl mb-4">Open now</h2>
          <div className="space-y-3">
            {openWindows.map((s) => {
              const def = windowDef(s.key);
              return (
                <TaskRow
                  key={s.key}
                  state="open"
                  title={def.labels.action}
                  href={`/cycles/${cycle.id}/${def.route}`}
                  closesAt={s.closesAt}
                />
              );
            })}
          </div>
        </div>
      )}

      {interlude && (
        <div className="mb-8">
          <TaskRow
            state="upcoming"
            title={windowDef("pod_registration").labels.action}
            detail="Voting has closed — the shortlist is being finalized."
            opensAt={interlude.opensAt}
          />
        </div>
      )}

      {/* Learning Log — the weekly practice, framed calmly (it replaced the pulse check) */}
      {cycle.status === "active" && (
        <div className="mb-8">
          <TaskRow
            title="Your weekly Learning Log"
            detail="A few lines each week on what you're figuring out. That's the check-in that keeps you in the cycle."
            href="/dashboard#learning-log"
            icon={
              <BookOpen
                className="h-5 w-5 flex-shrink-0 text-teal-deep"
                aria-hidden
              />
            }
          />
        </div>
      )}

      {/* The viewer's own submissions — visible in every phase, not just on
          the voting ballot */}
      {myStatements && myStatements.length > 0 && (
        <div className="mb-8">
          <h2 className="t-h3 mb-4 text-ink">Your problem situations</h2>
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
