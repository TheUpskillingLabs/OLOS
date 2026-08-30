// Pulse Insights was folded into the unified Insights page (2026-08-30):
// the AI-assisted Learning Log summary is the hero there, and this pod's
// pulse history (when it has any) renders under a historical divider.
// Permanent redirect so old links, bookmarks, and muscle memory keep
// working. No data changed hands in this move — pulse_checks and
// learning_logs are untouched; only the presentation moved.

import { redirect } from "next/navigation";

export default async function PodPulseInsightsRedirect({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  redirect(`/moderator/pods/${pod_id}/insights`);
}
