import Link from "next/link";
import { StatusBadge } from "@/app/components/ui";
import { getPodContext } from "@/lib/moderator/pod-context";
import { getLogHealth } from "@/lib/moderator/log-health";
import type { Band, Trend } from "@/lib/moderator/pulse-health";
import { podNoun } from "@/lib/cycle/labels";
import { PersistLastView } from "./persist-last-view";
import { NeedsAttention } from "./needs-attention";

export const dynamic = "force-dynamic";

/**
 * Overview — the pod surface's triage landing (poderator redesign, design
 * doc §3): status strip, the signal-grouped needs-attention list, the
 * log-health dials, and the next few workshops. Everything else moved one
 * click left: logs, pulse insights, feedback, and the roster are their own
 * sub-pages under the layout's nav. Deliberately current-state — this page
 * answers "what needs me NOW", so it carries no range filter.
 */
export default async function PodOverviewPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const ctx = await getPodContext(pod_id);
  const { detail, realMembers } = ctx;
  const isOrg = detail.cycle_mode === "org";
  const noun = podNoun(detail.cycle_mode);

  const memberIds = realMembers.map((m) => m.participant_id);

  const [health, rsvps] = await Promise.all([
    getLogHealth(ctx.serviceClient, detail.cycle_id, detail.members),
    memberIds.length
      ? ctx.serviceClient
          .from("event_rsvps")
          .select("participant_id, events!inner(id, name, start_at, status)")
          .in("participant_id", memberIds)
          .eq("events.status", "published")
          .gte("events.start_at", new Date().toISOString().slice(0, 10))
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // Blocked members who are ALSO at-risk already appear in the at-risk
  // group; only surface the rest as a separate signal.
  const atRiskIds = new Set(ctx.atRiskMembers.map((m) => m.participant_id));
  const blocked = health.blocked.filter((b) => !atRiskIds.has(b.participant_id));

  // Composite log-health average across whichever dials have data.
  const dialValues = [
    health.avg_progress,
    health.avg_energy,
    health.avg_clarity,
    health.avg_alignment,
  ].filter((v): v is number => v != null);
  const healthAvg =
    dialValues.length > 0
      ? Math.round(
          (dialValues.reduce((a, b) => a + b, 0) / dialValues.length) * 10
        ) / 10
      : null;
  const totalForLogs = health.logged_ids.length + health.waiting_ids.length;

  // Next workshops (soonest 3 of however many are scheduled).
  type EventGroup = { name: string; start_at: string; count: number };
  const byEvent = new Map<number, EventGroup>();
  for (const row of rsvps) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events;
    if (!event) continue;
    const entry: EventGroup = byEvent.get(event.id) ?? {
      name: event.name,
      start_at: event.start_at,
      count: 0,
    };
    entry.count += 1;
    byEvent.set(event.id, entry);
  }
  const upcoming = [...byEvent.values()]
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
    .slice(0, 3);

  const base = `/moderator/pods/${detail.id}`;

  return (
    <div>
      <PersistLastView podId={detail.id} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="t-h1 text-ink">{detail.name ?? `${noun} ${detail.id}`}</h1>
        <StatusBadge
          variant={detail.status === "active" ? "active" : detail.status === "forming" ? "forming" : "inactive"}
          withDot
        >
          {detail.status}
        </StatusBadge>
      </div>

      {/* ── Status strip (condensed StatusHeader, design doc §4) ── */}
      <div className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${isOrg ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
        <StripCell label="Phase">
          <div className="text-lg font-bold text-ink">
            {detail.phase_display_name ?? "—"}
          </div>
          {detail.phase_close_at && (
            <div className="mt-0.5 text-xs text-meta">
              {detail.phase_is_active ? "closes" : "opens"}{" "}
              <span className="tabular-nums">
                {formatDateTime(
                  detail.phase_is_active
                    ? detail.phase_close_at
                    : detail.phase_open_at ?? detail.phase_close_at
                )}
              </span>
            </div>
          )}
        </StripCell>

        {!isOrg && (
          <StripCell label="Logs this week">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-lg font-bold tabular-nums ${BAND_TEXT[detail.band]}`}>
                {detail.missing_this_week} missing
              </span>
              <span className={`text-xs ${TREND_COLOR[detail.trend]}`}>
                {TREND_ARROW[detail.trend]}
              </span>
            </div>
            <div className="mt-0.5 text-xs text-meta">band: {detail.band}</div>
          </StripCell>
        )}

        <StripCell label="Log health">
          <div className={`text-lg font-bold tabular-nums ${healthAvg != null && healthAvg < 3 ? "text-red" : "text-ink"}`}>
            {healthAvg != null ? `${healthAvg} / 5` : "—"}
          </div>
          <div className="mt-0.5 text-xs text-meta">
            {totalForLogs > 0
              ? `${health.logged_ids.length}/${totalForLogs} logged this window`
              : "no window armed"}
          </div>
        </StripCell>

        <StripCell label={`Active ${noun.toLowerCase() === "pod" ? "members" : "people"}`}>
          <div className="text-lg font-bold tabular-nums text-ink">
            {detail.active_member_count}
          </div>
          {ctx.trendingMembers.length > 0 && (
            <div className="mt-0.5 text-xs text-meta">
              {ctx.trendingMembers.length} trending toward at-risk
            </div>
          )}
        </StripCell>
      </div>

      {/* ── Needs attention: one row per signal ── */}
      {!isOrg && (
        <NeedsAttention
          podId={detail.id}
          atRisk={ctx.atRiskMembers}
          trending={ctx.trendingMembers}
          blocked={blocked}
          newFeedbackCount={ctx.newFeedbackCount}
          threshold={detail.at_risk_threshold}
        />
      )}

      {/* ── Digest row: log-health dials + next workshops ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="t-h3 text-ink">Log health</h2>
            <span className="text-xs text-meta">
              {health.window_due_at
                ? `window opened ${new Date(health.window_due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : "trailing 7 days"}
            </span>
          </div>
          {health.sample_size === 0 ? (
            <p className="mt-3 text-sm text-meta">
              No logs yet. Signals show up here once the {noun.toLowerCase()}{" "}
              starts logging.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Dial label="Progress" value={health.avg_progress} />
              <Dial label="Energy" value={health.avg_energy} />
              <Dial label="Clarity" value={health.avg_clarity} />
              <Dial label="Alignment" value={health.avg_alignment} />
              <Dial
                label="Logged"
                text={totalForLogs > 0 ? `${health.logged_ids.length}/${totalForLogs}` : "—"}
                low={totalForLogs > 0 && health.logged_ids.length / totalForLogs < 0.5}
              />
            </div>
          )}
          <Link
            href={`${base}/logs`}
            className="mt-4 inline-block text-xs font-semibold text-teal-deep hover:brightness-110"
          >
            Open the logs →
          </Link>
        </section>

        <section className="rounded-card border border-ink/10 bg-white p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="t-h3 text-ink">Next workshops</h2>
            <span className="text-xs text-meta">
              {byEvent.size} with sign-ups this cycle
            </span>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-meta">No upcoming sign-ups yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-ink/10">
              {upcoming.map((e) => (
                <li key={e.name} className="flex items-baseline justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                  <span className="text-charcoal">
                    {e.name}
                    <span className="ml-1.5 text-xs text-meta">
                      {new Date(e.start_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-xs tabular-nums text-meta">
                    {e.count} of {realMembers.length}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-meta-soft">
            Low sign-ups are a nudge opportunity, not a metric.
          </p>
        </section>
      </div>
    </div>
  );
}

// ─── Strip + dial primitives ───────────────────────────────────────────

const BAND_TEXT: Record<Band, string> = {
  healthy: "text-ink",
  warning: "text-red",
  critical: "text-red",
};
const TREND_ARROW: Record<Trend, string> = { up: "↑", down: "↓", flat: "→" };
const TREND_COLOR: Record<Trend, string> = {
  up: "text-teal-deep",
  down: "text-red",
  flat: "text-meta",
};

function StripCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-ink/10 bg-white p-4 shadow-card">
      <div className="lbl lbl-teal mb-1">{label}</div>
      {children}
    </div>
  );
}

function Dial({
  label,
  value,
  text,
  low,
}: {
  label: string;
  value?: number | null;
  text?: string;
  low?: boolean;
}) {
  const display = text ?? (value != null ? String(value) : "—");
  const isLow = low ?? (value != null && value < 3);
  return (
    <div className="rounded-card border border-ink/10 px-3 py-2 text-center">
      <div className={`text-base font-bold tabular-nums ${isLow ? "text-red" : "text-ink"}`}>
        {display}
        {value != null && <span className="text-xs font-normal text-meta"> / 5</span>}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-meta">
        {label}
      </div>
    </div>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
