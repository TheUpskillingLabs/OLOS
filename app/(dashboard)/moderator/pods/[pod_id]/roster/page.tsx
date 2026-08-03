// Roster — the members table + recent-activity tabs, kept whole (design doc
// §3: "it just stops sharing a page with six other panels"). Row click
// reuses today's member panel as-is (settled 2026-08-02). Current-state by
// design, so no range control — the list always shows the pod as it is now.

import { ContactsDownloadButton } from "@/app/components/contacts-download-button";
import { getPodContext } from "@/lib/moderator/pod-context";
import { getUiState } from "@/lib/moderator/ui-state";
import { podNoun } from "@/lib/cycle/labels";
import { PodContentTabs } from "../pod-content-tabs";

export const dynamic = "force-dynamic";

export default async function PodRosterPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const ctx = await getPodContext(pod_id);
  const { detail } = ctx;

  const memberIds = detail.members.map((m) => m.participant_id);
  const [uiState, logCountRes, pulseCountRes] = await Promise.all([
    getUiState(ctx.serviceClient, ctx.userRoles.participantId),
    memberIds.length
      ? ctx.serviceClient
          .from("learning_logs")
          .select("id", { head: true, count: "exact" })
          .in("participant_id", memberIds)
          .eq("cycle_id", detail.cycle_id)
      : Promise.resolve({ count: 0 }),
    memberIds.length
      ? ctx.serviceClient
          .from("pulse_checks")
          .select("id", { head: true, count: "exact" })
          .in("participant_id", memberIds)
          .eq("cycle_id", detail.cycle_id)
          .not("completed_at", "is", null)
      : Promise.resolve({ count: 0 }),
  ]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="t-h1 text-ink">Roster</h1>
          <p className="mt-1 text-sm text-slate">
            {detail.active_member_count} active — health at a glance, contact
            when you need it.
          </p>
        </div>
        <ContactsDownloadButton href={`/api/pods/${ctx.podId}/contacts/export`} />
      </div>

      <PodContentTabs
        members={detail.members}
        podId={detail.id}
        podName={detail.name ?? `${podNoun(detail.cycle_mode)} ${detail.id}`}
        initialTab={uiState.last_pod_tab ?? "members"}
        mode={detail.cycle_mode}
        hasLogs={(logCountRes.count ?? 0) > 0}
        hasPulses={(pulseCountRes.count ?? 0) > 0}
      />
    </div>
  );
}
