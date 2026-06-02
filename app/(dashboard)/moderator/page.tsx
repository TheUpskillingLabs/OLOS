import Link from "next/link";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModerator, can } from "@/lib/auth/roles";
import { EmptyState, StatusBadge } from "@/app/components/ui";
import { getPodsForUser, type PodCard } from "@/lib/moderator/pods-list";
import { getRollup } from "@/lib/moderator/rollup";
import { getCrossPodInsights } from "@/lib/moderator/cross-pod-insights";
import { CrossPodInsightsSection } from "./cross-pod-insights-section";
import { getUiState } from "@/lib/moderator/ui-state";
import { Switcher } from "./switcher";
import type { Band, Trend } from "@/lib/moderator/pulse-health";

/**
 * All pods view (PRD §7.10).
 *
 * RSC composition:
 *   - cross-pod at-risk nudges (§7.2)        — deferred to chunk 8
 *   - pod summary cards (§7.10.1)            — this chunk
 *   - members-needing-attention rollup (§7.10.2) — this chunk
 *   - cross-pod pulse insights (§7.9.3)      — deferred to chunk 6 of build order
 *   - AI-assisted summary block (§7.10.3)    — deferred to chunk 7 of build order
 *
 * Rollup + summary cards are suppressed for single-pod poderators per
 * PRD §7.10 (their default landing is the per-pod view).
 */
export default async function ModeratorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Service client used for the moderator-dashboard queries; mirrors the
  // pattern in the previous stub.
  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);

  const hasPodAccess = can(userRoles, "pods:read") || isModerator(userRoles);
  if (!hasPodAccess) redirect("/cycles");

  const admin = isAdmin(userRoles) || can(userRoles, "pods:read");
  const [cards, uiState] = await Promise.all([
    getPodsForUser(serviceClient, userRoles),
    getUiState(serviceClient, userRoles.participantId),
  ]);

  // PRD §7.7: first-time single-pod poderators land on their pod;
  // first-time multi-pod poderators land here. Returning poderators
  // land wherever they last were — if they last viewed a pod we redirect.
  if (!admin && cards.length === 1 && uiState.last_view === null) {
    redirect(`/moderator/pods/${cards[0].id}`);
  }
  if (uiState.last_view && uiState.last_view !== "all_pods") {
    const numericId = Number(uiState.last_view);
    if (
      !Number.isNaN(numericId) &&
      cards.some((c) => c.id === numericId)
    ) {
      redirect(`/moderator/pods/${numericId}`);
    }
  }

  // Single-pod poderators don't see the All pods aggregates (PRD §7.10).
  // Admins always see the full view because their assignment count is
  // effectively unbounded.
  const showAggregates = admin || cards.length > 1;

  const podIds = cards.map((c) => c.id);
  const cycleIds = Array.from(new Set(cards.map((c) => c.cycle_id)));

  const [rollup, crossPodFourWeeks, crossPodFullCycle, aiPromptRow] =
    showAggregates
      ? await Promise.all([
          getRollup(serviceClient, { podIds }),
          getCrossPodInsights(serviceClient, podIds, "4w"),
          getCrossPodInsights(serviceClient, podIds, "full"),
          cycleIds.length > 0
            ? serviceClient
                .from("cycle_config")
                .select("ai_summary_prompt")
                .in("cycle_id", cycleIds)
                .limit(1)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ])
      : [null, null, null, { data: null }];

  const aiSummaryPrompt =
    (aiPromptRow.data?.ai_summary_prompt as string | null) ?? null;

  const switcherPods = cards.map((c) => ({
    id: c.id,
    name: c.name ?? `Pod ${c.id}`,
  }));
  const showAllPodsEntry = admin || cards.length > 1;

  return (
    <div>
      {(showAllPodsEntry || cards.length > 0) && (
        <div className="mb-4">
          <Switcher
            pods={switcherPods}
            current="all_pods"
            showAllPods={showAllPodsEntry}
          />
        </div>
      )}
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">
        {admin ? "All pods" : "My pods"}
      </h1>
      <p className="mb-8 text-sm text-cloud/80">
        {admin
          ? "Pod health across cycles. Click a card to open the per-pod dashboard."
          : cards.length === 1
            ? "Your assigned pod. Click to open the per-pod dashboard."
            : "Pod health across your assignments. Click a card to open the per-pod dashboard."}
      </p>

      {cards.length === 0 ? (
        <EmptyState
          icon={Users}
          title={admin ? "No pods yet" : "No assigned pods"}
          description={
            admin
              ? "No pods have been created yet."
              : "You are not currently assigned to moderate any pods."
          }
        />
      ) : (
        <div className="space-y-8">
          <PodCardGrid cards={cards} />
          {rollup && (
            <RollupBlock
              rollup={rollup}
              podCount={cards.length}
            />
          )}
          {crossPodFourWeeks && crossPodFullCycle && (
            <CrossPodInsightsSection
              fourWeeks={crossPodFourWeeks}
              fullCycle={crossPodFullCycle}
              aiSummaryPrompt={aiSummaryPrompt}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pod summary cards (§7.10.1) ─────────────────────────────────────

const POD_STATUS_VARIANT: Record<string, "active" | "forming" | "inactive"> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

const TREND_ARROW: Record<Trend, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const TREND_COLOR: Record<Trend, string> = {
  // PRD: ↓ in completion is good (warmer); ↑ in completion is good (cooler).
  // For pulse-health "missing", trend reads from the completion rate so
  // we want ↑ to indicate "more completion → cooler", ↓ to be a warning.
  up: "text-aqua",
  down: "text-yellow-300",
  flat: "text-cloud/50",
};

const BAND_TEXT: Record<Band, string> = {
  healthy: "text-white",
  warning: "text-yellow-300",
  critical: "text-red-300",
};

function PodCardGrid({ cards }: { cards: PodCard[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <PodSummaryCard key={card.id} card={card} />
      ))}
    </div>
  );
}

function PodSummaryCard({ card }: { card: PodCard }) {
  const statusVariant = POD_STATUS_VARIANT[card.status] ?? "inactive";
  const phaseSuffix = card.phase_close_at
    ? formatPhaseSuffix(card.phase_open_at, card.phase_close_at)
    : null;

  return (
    <Link
      href={`/moderator/pods/${card.id}`}
      className="block rounded-md border border-whisper bg-white/[0.02] p-5 transition-colors duration-150 ease-out hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 text-xs uppercase tracking-widest text-cloud/40">
            Pod
          </div>
          <div className="truncate text-base font-semibold text-white">
            {card.name ?? `Pod ${card.id}`}
          </div>
        </div>
        <StatusBadge variant={statusVariant} withDot>
          {card.status}
        </StatusBadge>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs text-cloud/60">Pulse this week</div>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold tabular-nums ${BAND_TEXT[card.band]}`}
            >
              {card.missing_this_week}
            </span>
            <span className="text-xs text-cloud/50">missing</span>
            <span className={`ml-auto text-xs ${TREND_COLOR[card.trend]}`}>
              {TREND_ARROW[card.trend]}
            </span>
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-cloud/60">Members</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-white">
              {card.active_member_count}
            </span>
            <span className="text-xs text-cloud/50">active</span>
          </div>
        </div>
      </div>

      {(card.phase_display_name || phaseSuffix) && (
        <div className="mt-5 border-t border-whisper pt-4 text-xs text-cloud/60">
          {card.phase_num && (
            <span className="text-cloud/40">Phase {card.phase_num}</span>
          )}
          {card.phase_num && card.phase_display_name && (
            <span>
              {" · "}
              {stripPhasePrefix(card.phase_display_name)}
            </span>
          )}
          {phaseSuffix && <span>{` · ${phaseSuffix}`}</span>}
        </div>
      )}
    </Link>
  );
}

function stripPhasePrefix(displayName: string): string {
  // "Phase 4: Solution Proposals" → "Solution Proposals"
  return displayName.replace(/^Phase \d+:\s*/, "");
}

function formatPhaseSuffix(
  openAt: string | null,
  closeAt: string | null
): string | null {
  if (!closeAt) return null;
  const now = Date.now();
  const close = new Date(closeAt).getTime();
  const open = openAt ? new Date(openAt).getTime() : null;
  const dayMs = 86_400_000;

  if (open !== null && now < open) {
    const days = Math.max(1, Math.ceil((open - now) / dayMs));
    return `opens in ${days}d`;
  }
  if (now > close) return "closed";
  const days = Math.max(1, Math.ceil((close - now) / dayMs));
  return `closes in ${days}d`;
}

// ─── Members-needing-attention rollup (§7.10.2) ──────────────────────

function RollupBlock({
  rollup,
  podCount,
}: {
  rollup: NonNullable<Awaited<ReturnType<typeof getRollup>>>;
  podCount: number;
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="mb-1.5 text-xs uppercase tracking-widest text-teal">
          Across your pods
        </div>
        <h2 className="text-lg font-semibold text-white">Members needing attention</h2>
      </div>

      <div className="rounded-md border border-teal/20 bg-teal/[0.04] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-aqua/80">
            All your pods combined
          </div>
          <span className="text-xs tabular-nums text-cloud/50">
            {rollup.totalActiveMembers} member
            {rollup.totalActiveMembers === 1 ? "" : "s"} across {podCount} pod
            {podCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI
            label="Pulsing this week"
            value={rollup.pulsingThisWeek.submitted}
            valueClass="text-white"
            inline={`of ${rollup.pulsingThisWeek.total}`}
            sub={`${rollup.pulsingThisWeek.percent}%`}
          />
          <KPI
            label="At risk"
            value={rollup.atRisk.members}
            valueClass={
              rollup.atRisk.members > 0 ? "text-yellow-300" : "text-white"
            }
            inline="members"
            sub={
              rollup.atRisk.members === 0
                ? "no pods affected"
                : `${rollup.atRisk.podsAffected} pod${rollup.atRisk.podsAffected === 1 ? "" : "s"} affected`
            }
          />
          <KPI
            label={`Pulses this period`}
            value={rollup.pulsesThisPeriod.submitted}
            valueClass="text-white"
            inline="submitted"
            sub={`of ${rollup.pulsesThisPeriod.possible} possible · ${rollup.pulsesThisPeriod.periodWeeks}w`}
          />
          <KPI
            label="Engagement trend"
            value={`${rollup.engagementTrend.currentPercent}%`}
            valueClass="text-white"
            inlineNode={
              <span className={`text-base ${TREND_COLOR[rollup.engagementTrend.trend]}`}>
                {TREND_ARROW[rollup.engagementTrend.trend]}
              </span>
            }
            sub={
              rollup.engagementTrend.priorPercent === null
                ? "not enough history yet"
                : `${rollup.engagementTrend.trend === "down" ? "down" : rollup.engagementTrend.trend === "up" ? "up" : "even"} from ${rollup.engagementTrend.priorPercent}% last week`
            }
          />
        </div>
      </div>
    </section>
  );
}

function KPI({
  label,
  value,
  valueClass,
  inline,
  inlineNode,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  valueClass: string;
  inline?: string;
  inlineNode?: React.ReactNode;
  sub: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-cloud/60">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${valueClass}`}>
          {value}
        </span>
        {inline && <span className="text-xs text-cloud/60">{inline}</span>}
        {inlineNode}
      </div>
      <div className="mt-1 text-xs tabular-nums text-cloud/50">{sub}</div>
    </div>
  );
}
