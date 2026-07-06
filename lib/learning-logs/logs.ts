import { createServiceClient } from "@/lib/supabase/server";
import {
  type LearningLogInput,
  sharedParagraph,
} from "@/lib/validations/learning-logs";
import { getCycleWeek } from "@/lib/cycle/week";
import { milestoneKindForWeek, type MilestoneKind } from "@/lib/cycle/milestones";

/* The Learning Log create/read, factored out of app/api/learning-logs/route.ts
   so both the authenticated web form and the Slack /learninglog slash command
   share ONE implementation — identity is the only difference (session cookie
   vs. a verified slack_user_id → participant mapping). cycle_id and kind are
   derived server-side from the member's active enrollment; the caller never
   supplies them. Uses the service client throughout (participantId is always
   server-derived from a trusted identity, exactly as learningLogGate and the
   reminder cron already do). */

export interface CreateLearningLogResult {
  logId: number;
  createdAt: string;
  /** true only when the reflection was shared AND had content to share. */
  shared: boolean;
}

export async function createLearningLog(
  participantId: number,
  input: LearningLogInput
): Promise<CreateLearningLogResult> {
  const service = createServiceClient();

  // Derive the cycle from the member's active enrollment in the active cycle —
  // never trusted from the caller. NULL cycle = standalone/journal reflection.
  const { data: activeCycle } = await service
    .from("cycles")
    .select("id, start_date, end_date")
    .eq("status", "active")
    .maybeSingle();

  let cycleId: number | null = null;
  let kind: "weekly" | MilestoneKind = "weekly";
  if (activeCycle) {
    const { data: enrollment } = await service
      .from("cycle_enrollments")
      .select("id")
      .eq("participant_id", participantId)
      .eq("cycle_id", activeCycle.id)
      .eq("status", "active")
      .maybeSingle();
    if (enrollment) {
      cycleId = activeCycle.id;
      // Milestone weeks are admin-configurable (cycle_config, 00047); if the
      // current cycle week is one of them, this log is that evaluation.
      const { data: cfg } = await service
        .from("cycle_config")
        .select("milestone_mid_week, milestone_final_week")
        .eq("cycle_id", activeCycle.id)
        .maybeSingle();
      if (cfg && activeCycle.start_date && activeCycle.end_date) {
        const week = getCycleWeek(
          new Date(),
          new Date(activeCycle.start_date),
          new Date(activeCycle.end_date)
        );
        kind = milestoneKindForWeek(week, cfg) ?? "weekly";
      }
    }
  }

  const { data: log, error } = await service
    .from("learning_logs")
    .insert({
      participant_id: participantId,
      cycle_id: cycleId,
      kind,
      clarity: input.clarity,
      alignment: input.alignment,
      is_blocked: input.is_blocked,
      blocker_context: input.is_blocked
        ? input.blocker_context?.trim() || null
        : null,
      accomplished: input.accomplished?.trim() || null,
      exploring: input.exploring?.trim() || null,
      next_focus: input.next_focus?.trim() || null,
      share_publicly: input.share_publicly,
    })
    .select("id, created_at")
    .single();
  if (error || !log) {
    throw new Error(
      `learning_logs insert failed: ${error?.message ?? "no row returned"}`
    );
  }

  // The share: paragraph only, metrics never travel (backend doc §6).
  // profile_updates is the only write path into the member-updates feed.
  let shared = false;
  if (input.share_publicly) {
    const paragraph = sharedParagraph(input);
    if (paragraph) {
      const { error: shareError } = await service.from("profile_updates").insert({
        participant_id: participantId,
        learning_log_id: log.id,
        body: paragraph,
      });
      shared = !shareError;
      if (shareError)
        console.error("[learning-log] share failed:", shareError.message);
    }
  }

  return {
    logId: log.id as number,
    createdAt: log.created_at as string,
    shared,
  };
}

export interface RecentLog {
  id: number;
  kind: string;
  clarity: number;
  alignment: number;
  is_blocked: boolean;
  accomplished: string | null;
  exploring: string | null;
  next_focus: string | null;
  share_publicly: boolean;
  created_at: string;
}

/* The member's own logs, newest first, plus a total count — feeds the
   dashboard card's history and the /learninglog view command. */
export async function getRecentLogs(
  participantId: number,
  limit = 50
): Promise<{ logs: RecentLog[]; count: number }> {
  const service = createServiceClient();
  const { data, count } = await service
    .from("learning_logs")
    .select(
      "id, kind, clarity, alignment, is_blocked, accomplished, exploring, next_focus, share_publicly, created_at",
      { count: "exact" }
    )
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { logs: (data ?? []) as RecentLog[], count: count ?? 0 };
}
