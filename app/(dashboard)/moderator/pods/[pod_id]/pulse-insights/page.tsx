// Pulse Insights — the pulse trend/analysis block on its own page (design
// doc §3). PodInsightsSection keeps its native "Last 4 weeks / Full cycle"
// toggle as the range control here: pulses aggregate weekly, so a
// "this week" cut is a single point and adds nothing. Org-mode runs have
// no pulse instrument — the nav hides this item and the page redirects.

import { redirect } from "next/navigation";
import { getPodContext } from "@/lib/moderator/pod-context";
import { getPodInsights } from "@/lib/moderator/pod-insights";
import { PodInsightsSection } from "../insights-section";

export const dynamic = "force-dynamic";

export default async function PodPulseInsightsPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const ctx = await getPodContext(pod_id);

  if (ctx.detail.cycle_mode === "org") {
    redirect(`/moderator/pods/${ctx.podId}`);
  }

  const [fourWeeks, fullCycle, aiPromptRow] = await Promise.all([
    getPodInsights(ctx.serviceClient, ctx.podId, "4w"),
    getPodInsights(ctx.serviceClient, ctx.podId, "full"),
    ctx.serviceClient
      .from("cycle_config")
      .select("ai_summary_prompt")
      .eq("cycle_id", ctx.detail.cycle_id)
      .maybeSingle(),
  ]);
  const aiSummaryPrompt =
    (aiPromptRow?.data?.ai_summary_prompt as string | null) ?? null;

  if (!fourWeeks || !fullCycle) {
    // getPodInsights returns null when the pod vanished mid-request.
    redirect("/moderator");
  }

  return (
    <div>
      <h1 className="t-h1 text-ink">Pulse Insights</h1>
      <p className="mb-6 mt-1 text-sm text-slate">
        Pulse trends and comment analysis. Aggregate only, never per-member
        attribution.
      </p>
      <PodInsightsSection
        fourWeeks={fourWeeks}
        fullCycle={fullCycle}
        aiSummaryPrompt={aiSummaryPrompt}
      />
    </div>
  );
}
