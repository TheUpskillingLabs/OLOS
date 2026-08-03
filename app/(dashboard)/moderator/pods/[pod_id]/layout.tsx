import Link from "next/link";
import { getPodContext } from "@/lib/moderator/pod-context";
import { getLogHealth } from "@/lib/moderator/log-health";
import { ENTITY_EXPLORER_ENABLED } from "@/lib/entity-explorer/flag";
import { podNoun } from "@/lib/cycle/labels";
import { PodNav, type PodNavBadges } from "./_nav/pod-nav";

/**
 * The pod surface shell (poderator redesign, design doc §3/§5): left nav with
 * the pod filter + badge counts, wrapping every sub-page (Overview, logs,
 * pulse insights, feedback, roster, and the Entity Explorer). The guard runs
 * in getPodContext — React.cache()'d, so the active sub-page's own call is
 * free. Badges always reflect the current week, whatever ?range says.
 */
export default async function PodLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const ctx = await getPodContext(pod_id);
  const { detail, realMembers } = ctx;

  const isOrg = detail.cycle_mode === "org";
  const noun = podNoun(detail.cycle_mode);
  const podName = detail.name ?? `${noun} ${detail.id}`;

  // Logs badge (logged/total for the current window) + pulse presence.
  const [health, pulseCountRes] = await Promise.all([
    getLogHealth(ctx.serviceClient, detail.cycle_id, detail.members),
    isOrg || realMembers.length === 0
      ? Promise.resolve({ count: 0 })
      : ctx.serviceClient
          .from("pulse_checks")
          .select("id", { head: true, count: "exact" })
          .in("participant_id", realMembers.map((m) => m.participant_id))
          .eq("cycle_id", detail.cycle_id)
          .not("completed_at", "is", null),
  ]);

  const totalForLogs = health.logged_ids.length + health.waiting_ids.length;
  const badges: PodNavBadges = {
    attention:
      ctx.atRiskMembers.length +
      ctx.trendingMembers.length +
      (ctx.newFeedbackCount > 0 ? 1 : 0),
    logs: totalForLogs > 0 ? `${health.logged_ids.length}/${totalForLogs}` : null,
    feedback: ctx.newFeedbackCount,
    roster: detail.active_member_count,
    pulsesEmpty: (pulseCountRes.count ?? 0) === 0,
  };

  const cycleLine = [
    detail.cycle_name,
    detail.phase_short_name ?? detail.phase_display_name,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex gap-8">
      <div>
        {/* ?view=all skips the returning-poderator redirect on /moderator. */}
        <Link
          href="/moderator?view=all"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-ink"
        >
          ← All {noun.toLowerCase()}s
        </Link>
        <PodNav
          podId={detail.id}
          podName={podName}
          cycleLine={cycleLine || noun}
          pods={ctx.switcherPods.map((p) => ({
            id: p.id,
            name: p.name ?? `${noun} ${p.id}`,
          }))}
          badges={badges}
          showExplorer={ENTITY_EXPLORER_ENABLED}
          showPulseInsights={!isOrg}
        />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
