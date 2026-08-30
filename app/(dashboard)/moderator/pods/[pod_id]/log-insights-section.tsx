import { createServiceClient } from "@/lib/supabase/server";
import { CopyBundleBlock } from "../../ai-summary-block";
import {
  buildLogEntries,
  buildLogInsightsBundle,
  type LogInsightRow,
} from "@/lib/moderator/log-insights";

/* The Learning Log successor to the pulse AI-assisted summary: bundles the
   pod's recent Learning Log reflections — partially anonymized (stable
   pseudonyms, no names/emails; see lib/moderator/log-insights.ts for the
   contract) — behind the LOG_INSIGHTS_PROMPT meta-prompt, for pasting into
   the poderator's own AI tool. Server component: fetches with the service
   client (the moderator logs page is already role-gated by getPodContext),
   scoped by the page's own range param so this section and the entries feed
   always agree on what "recent" means.

   Baselines are excluded: they're the onboarding reflection (their answers
   live in baseline_responses, not these columns) and would only add
   ratings-only noise to the weekly signal. */

export async function LogInsightsSection({
  cycleId,
  memberIds,
  since,
  rangeLabel,
}: {
  cycleId: number;
  /** Real members only — the caller filters out staff/test and inactive. */
  memberIds: number[];
  /** Range floor; null = full cycle (rangeSince's contract). */
  since: string | null;
  rangeLabel: string;
}) {
  let rows: LogInsightRow[] = [];
  if (memberIds.length > 0) {
    const supabase = createServiceClient();
    let query = supabase
      .from("learning_logs")
      .select(
        "participant_id, created_at, kind, is_blocked, progress_rating, energy_rating, work_summary, work_progress, work_blockers, stuck_tried, learned, contribution, recognition, clarity, alignment, accomplished, exploring, next_focus, blocker_context"
      )
      .eq("cycle_id", cycleId)
      .in("participant_id", memberIds)
      .neq("kind", "baseline")
      .order("created_at", { ascending: true });
    if (since) query = query.gte("created_at", since);
    const { data } = await query;
    rows = (data as LogInsightRow[] | null) ?? [];
  }

  const entries = buildLogEntries(rows);
  const bundle = buildLogInsightsBundle(entries);

  return (
    <div className="mb-6">
      <CopyBundleBlock
        title="AI-assisted log summary"
        description="Bundle this pod's recent Learning Log reflections — partially anonymized — with a ready-to-use prompt and paste into ChatGPT, Claude, or your AI tool of choice. The prompt asks for what's working, what needs improvement, targeted outreach per member, and what to escalate."
        itemsLabel="Learning Log entries"
        scopeLabel="this pod"
        emptyMessage="No Learning Logs in this range yet."
        items={entries}
        bundle={bundle}
        rangeLabel={rangeLabel}
      />
    </div>
  );
}
