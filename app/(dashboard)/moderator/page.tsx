import Link from "next/link";
import { parseWindow } from "@/lib/cycles/lab-time";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModerator, can } from "@/lib/auth/roles";
import { EmptyState, StatusBadge } from "@/app/components/ui";
import {
  getPodsForUser,
  groupCardsByLab,
  type PodCard,
} from "@/lib/moderator/pods-list";
import { getRollup } from "@/lib/moderator/rollup";
import { getCrossPodInsights } from "@/lib/moderator/cross-pod-insights";
import { CrossPodInsightsSection } from "./cross-pod-insights-section";
import { getUiState } from "@/lib/moderator/ui-state";
import { getFieldSurveyForCycle } from "@/lib/content/surveys";
import OrientationCard from "./orientation-card";
import { Switcher } from "./switcher";
import type { Band, Trend } from "@/lib/moderator/pulse-health";
import { podNoun, moderatorNoun } from "@/lib/cycle/labels";

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
export default async function ModeratorPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  /**
   * Explicit "show me All pods" intent — set by the back-arrow link on
   * per-pod pages and by the Switcher's "All pods" item. Required to
   * defeat the returning-poderator auto-redirect below, which would
   * otherwise immediately bounce the user back to the pod they came
   * from (last_view still points at it; the persist call is
   * fire-and-forget and races the navigation).
   */
  const explicitAllPods = sp.view === "all";

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
  // land wherever they last were — if they last viewed a pod we redirect,
  // UNLESS the request explicitly opted into All pods via ?view=all.
  if (!explicitAllPods && !admin && cards.length === 1 && uiState.last_view === null) {
    redirect(`/moderator/pods/${cards[0].id}`);
  }
  if (!explicitAllPods && uiState.last_view && uiState.last_view !== "all_pods") {
    const numericId = Number(uiState.last_view);
    if (
      !Number.isNaN(numericId) &&
      cards.some((c) => c.id === numericId)
    ) {
      redirect(`/moderator/pods/${numericId}`);
    }
  }

  // P-7 / B-1: partition cards into participant pods vs. org workstream
  // runs. Sort order within each subset is preserved — `cards` is already
  // sorted (non-zero missing first, then alphabetical) and `.filter()`
  // keeps relative order.
  const participantCards = cards.filter((c) => c.cycle_mode !== "org");
  const orgCards = cards.filter((c) => c.cycle_mode === "org");
  const hasParticipantCards = participantCards.length > 0;
  const hasOrgCards = orgCards.length > 0;
  const sectioned = hasParticipantCards && hasOrgCards;
  const allOrg = hasOrgCards && !hasParticipantCards;

  // Single-pod poderators don't see the All pods aggregates (PRD §7.10).
  // Admins always see the full view because their assignment count is
  // effectively unbounded.
  const showAggregates = admin || participantCards.length > 1;

  // Rollup + cross-pod insights are pulse-health aggregates — workstreams
  // don't run pulse checks, so scope both to the participant-pod subset
  // (PRD-admin-org-separation §5, P-7/B-1).
  const podIds = participantCards.map((c) => c.id);
  const cycleIds = Array.from(new Set(participantCards.map((c) => c.cycle_id)));

  // Field-survey results for the poderator's cycle(s) — the sensemaking raw
  // material + CSV export sit one click from the pods they shepherd.
  const surveyLinks = (
    await Promise.all(
      cycleIds.map(async (cid) => {
        const s = await getFieldSurveyForCycle(cid, null);
        return s ? { slug: s.share_slug, title: s.title } : null;
      })
    )
  ).filter((x): x is { slug: string; title: string } => x !== null);

  const [rollup, crossPodFourWeeks, crossPodFullCycle, aiPromptRow] =
    showAggregates && podIds.length > 0
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

  // P-7 / B-1: admins with both kinds present get the combined heading;
  // a non-admin whose cards are entirely org runs gets workstream/co-lead
  // framing instead of "pod" copy.
  const heading = admin
    ? sectioned
      ? "All pods & workstreams"
      : "All pods"
    : allOrg
      ? "My workstreams"
      : "My pods";

  const subtitle = admin
    ? "Pod health across cycles. Click a card to open the per-pod dashboard."
    : allOrg
      ? cards.length === 1
        ? `Your assigned workstream — you're the ${moderatorNoun(cards[0].cycle_mode).toLowerCase()}. Click to open the dashboard.`
        : `Workstream health across your assignments as ${moderatorNoun(orgCards[0].cycle_mode).toLowerCase()}. Click a card to open the dashboard.`
      : cards.length === 1
        ? "Your assigned pod. Click to open the per-pod dashboard."
        : "Pod health across your assignments. Click a card to open the per-pod dashboard.";

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
      <h1 className="t-h1 mb-2 text-ink">
        {heading}
      </h1>
      <p className="mb-8 text-sm text-charcoal">
        {subtitle}
      </p>

      <OrientationCard tooltipSeen={uiState.tooltip_seen ?? []} />

      {surveyLinks.length > 0 && (
        <div className="mb-8 rounded-card border border-teal/20 bg-teal/[0.04] p-5">
          <div className="lbl lbl-teal mb-1.5">Field survey</div>
          <p className="mb-3 text-sm text-charcoal">
            The field observations that seed this cycle&apos;s problems — review
            responses and export the CSV for the Triangulator.
          </p>
          <div className="flex flex-col gap-2">
            {surveyLinks.map((s) => (
              <Link
                key={s.slug}
                href={`/survey/${s.slug}/results`}
                className="text-sm font-semibold text-teal-deep hover:underline"
              >
                {s.title} — view results &rarr;
              </Link>
            ))}
          </div>
        </div>
      )}

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
          {sectioned ? (
            <>
              <section>
                <h2 className="t-h3 mb-3 text-ink">Pods</h2>
                <SectionedByLab cards={participantCards} />
              </section>
              <section>
                <h2 className="t-h3 mb-3 text-ink">Workstreams</h2>
                <SectionedByLab cards={orgCards} />
              </section>
            </>
          ) : (
            <SectionedByLab cards={cards} />
          )}
          {rollup && (
            <RollupBlock
              rollup={rollup}
              podCount={participantCards.length}
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
  inactive: "inactive",
  dissolved: "inactive",
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
  up: "text-teal-deep",
  down: "text-red",
  flat: "text-meta",
};

const BAND_TEXT: Record<Band, string> = {
  healthy: "text-ink",
  warning: "text-red",
  critical: "text-red",
};

/**
 * Lab sectioning (PRD-lab-lead-ux Decision 8): mode sections stay primary;
 * lab subsections appear only when >1 lab identity is present among the
 * cards. Single-lab viewers get the plain grid — zero new chrome.
 */
function SectionedByLab({ cards }: { cards: PodCard[] }) {
  const groups = groupCardsByLab(cards);
  if (groups.length === 1) {
    return <PodCardGrid cards={groups[0].cards} />;
  }
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <div className="lbl mb-3">{group.label}</div>
          <PodCardGrid cards={group.cards} />
        </div>
      ))}
    </div>
  );
}

function PodCardGrid({ cards }: { cards: PodCard[] }) {
  return (
    <div className="autogrid">
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
  // Workstream runs don't pulse — the metric would always read "0 missing"
  // and imply a practice that doesn't exist for staff.
  const showPulse = card.cycle_mode !== "org";

  return (
    <Link
      href={`/moderator/pods/${card.id}`}
      className="block rounded-card border border-ink/10 bg-white p-5 shadow-card transition-colors duration-150 ease-out hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="lbl mb-1.5">
            {podNoun(card.cycle_mode)}
          </div>
          <div className="truncate text-base font-semibold text-ink">
            {card.name ?? `${podNoun(card.cycle_mode)} ${card.id}`}
          </div>
        </div>
        <StatusBadge variant={statusVariant} withDot>
          {card.status}
        </StatusBadge>
      </div>

      <div className={`mt-5 grid gap-3 ${showPulse ? "grid-cols-2" : "grid-cols-1"}`}>
        {showPulse && (
          <div>
            <div className="mb-1 text-xs text-meta">Pulse this week</div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-bold tabular-nums ${BAND_TEXT[card.band]}`}
              >
                {card.missing_this_week}
              </span>
              <span className="text-xs text-meta">missing</span>
              <span className={`ml-auto text-xs ${TREND_COLOR[card.trend]}`}>
                {TREND_ARROW[card.trend]}
              </span>
            </div>
          </div>
        )}
        <div>
          <div className="mb-1 text-xs text-meta">Members</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-ink">
              {card.active_member_count}
            </span>
            <span className="text-xs text-meta">active</span>
          </div>
        </div>
      </div>

      {(card.phase_display_name || phaseSuffix) && (
        <div className="mt-5 border-t border-ink/10 pt-4 text-xs text-meta">
          {card.phase_num && (
            <span className="text-meta-soft">Phase {card.phase_num}</span>
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
  // Window strings are naive-UTC instants (lib/cycles/lab-time.ts).
  const close = (parseWindow(closeAt) as Date).getTime();
  const open = openAt ? (parseWindow(openAt) as Date).getTime() : null;
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
        <div className="lbl lbl-teal mb-1.5">
          Across your pods
        </div>
        <h2 className="t-h3 text-ink">Members needing attention</h2>
      </div>

      <div className="rounded-card border border-teal/20 bg-teal/[0.04] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="lbl lbl-teal">
            All your pods combined
          </div>
          <span className="text-xs tabular-nums text-meta">
            {rollup.totalActiveMembers} member
            {rollup.totalActiveMembers === 1 ? "" : "s"} across {podCount} pod
            {podCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPI
            label="Pulsing this week"
            value={rollup.pulsingThisWeek.submitted}
            valueClass="text-ink"
            inline={`of ${rollup.pulsingThisWeek.total}`}
            sub={`${rollup.pulsingThisWeek.percent}%`}
          />
          <KPI
            label="At risk"
            value={rollup.atRisk.members}
            valueClass={
              rollup.atRisk.members > 0 ? "text-red" : "text-ink"
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
            valueClass="text-ink"
            inline="submitted"
            sub={`of ${rollup.pulsesThisPeriod.possible} possible · ${rollup.pulsesThisPeriod.periodWeeks}w`}
          />
          <KPI
            label="Engagement trend"
            value={`${rollup.engagementTrend.currentPercent}%`}
            valueClass="text-ink"
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
      <div className="mb-1.5 text-xs text-meta">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${valueClass}`}>
          {value}
        </span>
        {inline && <span className="text-xs text-meta">{inline}</span>}
        {inlineNode}
      </div>
      <div className="mt-1 text-xs tabular-nums text-meta">{sub}</div>
    </div>
  );
}
