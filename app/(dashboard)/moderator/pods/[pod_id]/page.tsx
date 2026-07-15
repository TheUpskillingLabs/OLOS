import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, Users } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { StatusBadge } from "@/app/components/ui";
import { getPodDetail, type PodDetail, type RosterRow } from "@/lib/moderator/pod-detail";
import { getPodInsights } from "@/lib/moderator/pod-insights";
import type { Band, Trend } from "@/lib/moderator/pulse-health";
import { PodInsightsSection } from "./insights-section";
import { DismissButton } from "./dismiss-button";
import { Switcher } from "../../switcher";
import { PersistLastView } from "./persist-last-view";
import { ManagedTooltip } from "../../tooltip-state";
import { getPodsForUser } from "@/lib/moderator/pods-list";
import { getUiState } from "@/lib/moderator/ui-state";
import { PodContentTabs } from "./pod-content-tabs";
import PodSquadSections from "./pod-squad-sections";
import PodMilestoneLogs from "./pod-milestone-logs";
import { podNoun } from "@/lib/cycle/labels";

export const dynamic = "force-dynamic";

/**
 * Per-pod view (PRD §7.1, §7.2, §7.3).
 *
 * Composition (top → bottom):
 *   - status header (pod + cycle + phase + pulse-health + close timestamp)
 *   - at-risk nudge cards (read-only — dismiss action is chunk 8)
 *   - pulse insights (§7.9.2 + §7.10.3 AI summary)
 *   - members / recent-pulses tab wrapper
 *
 * Pod Resources (§7.6), the second "phase opened" deadline cell, and
 * the Phase Guidance prose panel (§7.5) were intentionally removed —
 * the phase + close timestamp already live in the status header, and
 * the prose was judged not decision-driving.
 */
export default async function ModeratorPodPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const podId = Number.parseInt(pod_id, 10);
  if (Number.isNaN(podId)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);

  // Pod-scoped auth: admin (any pod) OR active moderator assignment for this pod.
  if (!isAdmin(userRoles) && !isModeratorForPod(userRoles, podId)) {
    redirect("/moderator");
  }

  const [detail, switcherCards, uiState] = await Promise.all([
    getPodDetail(serviceClient, podId, userRoles.participantId),
    getPodsForUser(serviceClient, userRoles),
    getUiState(serviceClient, userRoles.participantId),
  ]);
  if (!detail) notFound();
  const isOrg = detail.cycle_mode === "org";
  // Pass last_pod_tab through to seed the tab wrapper. Filter/sort still
  // hydrates from /api/moderator/ui-state in the client (see RosterTable).
  const initialTab = uiState.last_pod_tab ?? "members";

  // §7.9.2 pod-level insights — pre-compute both ranges so the client
  // toggle doesn't need a round-trip. Plus the AI-summary prompt for
  // §7.10.3. Org runs have no pulse checks, so skip the fetches entirely —
  // the insights section (and its AI summary) only exists for pods.
  const [fourWeeksInsights, fullCycleInsights, aiPromptRow] = isOrg
    ? [null, null, null]
    : await Promise.all([
        getPodInsights(serviceClient, podId, "4w"),
        getPodInsights(serviceClient, podId, "full"),
        serviceClient
          .from("cycle_config")
          .select("ai_summary_prompt")
          .eq("cycle_id", detail.cycle_id)
          .maybeSingle(),
      ]);
  const aiSummaryPrompt =
    (aiPromptRow?.data?.ai_summary_prompt as string | null) ?? null;

  const atRiskMembers = detail.members.filter(
    (m) => m.pulse_status === "at_risk" && !m.is_inactive && !m.nudge_dismissed
  );

  const switcherPods = switcherCards.map((c) => ({
    id: c.id,
    name: c.name ?? `Pod ${c.id}`,
  }));
  const showAllPodsEntry =
    isAdmin(userRoles) || switcherCards.length > 1;

  return (
    <div className="space-y-8">
      <PersistLastView podId={detail.id} />
      <div className="flex items-center gap-3">
        <BackLink />
        <Switcher
          pods={switcherPods}
          current={{ pod_id: detail.id }}
          showAllPods={showAllPodsEntry}
        />
      </div>
      <StatusHeader detail={detail} />

      {!isOrg && atRiskMembers.length > 0 && (
        <AtRiskSection
          members={atRiskMembers}
          podId={detail.id}
          podName={detail.name ?? `${podNoun(detail.cycle_mode)} ${detail.id}`}
          threshold={detail.at_risk_threshold}
        />
      )}

      {fourWeeksInsights && fullCycleInsights && (
        <PodInsightsSection
          fourWeeks={fourWeeksInsights}
          fullCycle={fullCycleInsights}
          aiSummaryPrompt={aiSummaryPrompt}
        />
      )}

      {/* Pod Squad sections: Learning-Log health (blocked first), workshop
          sign-ups, feedback inbox — the memo batch + Phase 1 repoint. */}
      <PodSquadSections cycleId={detail.cycle_id} members={detail.members} />

      {/* Milestone Logs: wk-mid/final evaluation status per member. */}
      <PodMilestoneLogs cycleId={detail.cycle_id} members={detail.members} />

      <PodContentTabs
        members={detail.members}
        podId={detail.id}
        podName={detail.name ?? `${podNoun(detail.cycle_mode)} ${detail.id}`}
        initialTab={initialTab}
        mode={detail.cycle_mode}
      />
    </div>
  );
}

function BackLink() {
  // ?view=all is required: /moderator auto-redirects returning poderators
  // back to their last-viewed pod, which is the very pod we're leaving.
  // The query param flags this as an explicit "All pods" intent so the
  // page skips the redirect.
  return (
    <Link
      href="/moderator?view=all"
      className="inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink"
    >
      ← All pods
    </Link>
  );
}

// ─── Status header (§7.1) ─────────────────────────────────────────────

const POD_STATUS_VARIANT: Record<string, "active" | "forming" | "inactive"> = {
  active: "active",
  forming: "forming",
  inactive: "inactive",
  dissolved: "inactive",
};

const BAND_TEXT: Record<Band, string> = {
  healthy: "text-ink",
  warning: "text-red",
  critical: "text-red",
};

const TREND_ARROW: Record<Trend, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const TREND_COLOR: Record<Trend, string> = {
  up: "text-teal-deep",
  down: "text-red",
  flat: "text-meta",
};

function StatusHeader({ detail }: { detail: PodDetail }) {
  const statusVariant = POD_STATUS_VARIANT[detail.status] ?? "inactive";
  const noun = podNoun(detail.cycle_mode);
  // Workstream runs have no pulse checks — drop the pulse cell rather than
  // show a permanently-empty metric.
  const isOrg = detail.cycle_mode === "org";
  return (
    <header>
      <div className="lbl mb-1.5">
        {detail.cycle_name ? `${detail.cycle_name} · ${noun}` : noun}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-h1 text-ink">
          {detail.name ?? `${noun} ${detail.id}`}
        </h1>
        <StatusBadge variant={statusVariant} withDot>
          {detail.status}
        </StatusBadge>
      </div>

      <div
        className={`mt-5 grid grid-cols-1 gap-4 rounded-card border border-ink/10 bg-white p-5 shadow-card ${
          isOrg ? "sm:grid-cols-2" : "sm:grid-cols-3"
        }`}
      >
        <div>
          <div className="mb-1 text-xs text-meta">Phase</div>
          <div className="text-base font-semibold text-ink">
            {detail.phase_display_name ?? "—"}
          </div>
          {detail.phase_close_at && (
            <div className="mt-1 text-xs text-meta">
              {detail.phase_is_active ? "Closes" : "Opens"}:{" "}
              <span className="tabular-nums text-ink">
                {formatDateTime(
                  detail.phase_is_active
                    ? detail.phase_close_at
                    : detail.phase_open_at ?? detail.phase_close_at
                )}
              </span>
            </div>
          )}
        </div>
        {!isOrg && (
          <div>
            <ManagedTooltip
              tooltipKey="pod_health_indicator"
              content="Count of active pod members who haven't submitted this week's pulse. Banded into healthy / warning / critical by cycle-configurable thresholds."
            >
              <div className="mb-1 text-xs text-meta">Pulse this week</div>
            </ManagedTooltip>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-bold tabular-nums ${BAND_TEXT[detail.band]}`}
              >
                {detail.missing_this_week}
              </span>
              <span className="text-xs text-meta">missing</span>
              <ManagedTooltip
                tooltipKey="trend_arrow"
                content="Trend vs. the prior 3 weeks. ↑ rising completion, ↓ falling, → flat (within 5pp tolerance)."
              >
                <span className={`ml-auto text-xs ${TREND_COLOR[detail.trend]}`}>
                  {TREND_ARROW[detail.trend]}
                </span>
              </ManagedTooltip>
            </div>
            <div className="mt-1 text-xs text-meta">
              band: {detail.band}
            </div>
          </div>
        )}
        <div>
          <div className="mb-1 text-xs text-meta">Active members</div>
          <div className="text-2xl font-bold tabular-nums text-ink">
            {detail.active_member_count}
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── At-risk nudges (§7.2) ────────────────────────────────────────────

function AtRiskSection({
  members,
  podId,
  podName,
  threshold,
}: {
  members: RosterRow[];
  podId: number;
  podName: string;
  threshold: number;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="t-h3 text-ink">
          At-risk · needs attention
        </h2>
        <span className="text-xs text-meta">
          {threshold}-pulse miss threshold
        </span>
      </div>
      <div className="space-y-3">
        {members.map((m) => (
          <AtRiskCard
            key={m.participant_id}
            member={m}
            podId={podId}
            podName={podName}
          />
        ))}
      </div>
    </section>
  );
}

function AtRiskCard({
  member,
  podId,
  podName,
}: {
  member: RosterRow;
  podId: number;
  podName: string;
}) {
  const lastActiveCopy = member.last_activity_at
    ? `last active ${daysAgo(member.last_activity_at)} days ago`
    : "no pulse activity yet";
  return (
    <div className="rounded-card border border-red/25 bg-red/[0.04] p-4">
      <div className="flex items-start gap-4">
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-teal text-sm font-semibold text-white">
          {member.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm font-semibold text-ink">
              {member.display_name}
            </span>
            {member.availability_snippet && (
              <>
                <span className="text-xs text-meta">·</span>
                <span className="truncate text-xs text-meta">
                  {member.availability_snippet}
                </span>
              </>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-red">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <ManagedTooltip
              tooltipKey="at_risk_nudge_type"
              content="At-risk nudge: fires when a member misses the configured consecutive-miss threshold. System flags only — you follow up via Slack or email."
            >
              <span className="font-medium">Missed consecutive pulses</span>
            </ManagedTooltip>
            <span className="text-meta-soft">·</span>
            <span className="text-meta">{lastActiveCopy}</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-sm bg-ink/[0.04] px-2 py-0.5 text-slate">
              <Users className="h-3 w-3" />
              {podName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="rounded-card bg-teal-deep px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal"
            >
              Email
            </a>
          )}
          {member.nudge_key && (
            <DismissButton podId={podId} nudgeKey={member.nudge_key} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Date helpers ────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function daysAgo(iso: string): number {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}
