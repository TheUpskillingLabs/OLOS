import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { requireCompleteProfile } from "@/lib/participants/placeholder";
import {
  learningLogSchema,
  sharedParagraph,
} from "@/lib/validations/learning-logs";
import { learningLogGate } from "@/lib/learning-logs/gate";
import { getCycleWeek } from "@/lib/cycle/week";
import {
  milestoneKindForWeek,
  type MilestoneKind,
} from "@/lib/cycle/milestones";

// The Learning Log (roadmap Phase 1; backend doc §6). One POST saves the
// three-part ritual; when share_publicly is set and the reflection has
// content, the concatenated paragraph (never the metrics) lands in
// profile_updates with learning_log_id provenance — the only write path
// into the member-updates feed (no composer, owner decision).
//
// cycle_id and kind are derived server-side (never trusted from the client):
// the active enrollment decides the cycle (NULL = standalone reflection); kind
// is the milestone variant when the current cycle week matches an admin-set
// milestone week (cycle_config.milestone_mid_week/final_week), else 'weekly'.
// Any log clears the weekly gate — the response says so ("You're back in ✓").

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json(
        { error: "No participant record" },
        { status: 403 }
      );
    }

    const guard = await requireCompleteProfile(auth.supabase, participantId);
    if (guard) return guard;

    // Read the gate BEFORE the write: a saved log always satisfies the
    // current window, so "cleared" means "you were locked and now you're
    // not" — never a false "you're back in ✓" for members who were never
    // locked.
    const gateBefore = await learningLogGate(participantId);

    const body = await parseBody(request, learningLogSchema);
    if (isErrorResponse(body)) return body;

    // Derive the cycle from the member's active enrollment in the active
    // cycle — never trusted from the client.
    const service = createServiceClient();
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

    const { data: log, error } = await auth.supabase
      .from("learning_logs")
      .insert({
        participant_id: participantId,
        cycle_id: cycleId,
        kind,
        clarity: body.clarity,
        alignment: body.alignment,
        is_blocked: body.is_blocked,
        blocker_context: body.is_blocked
          ? (body.blocker_context?.trim() || null)
          : null,
        accomplished: body.accomplished?.trim() || null,
        exploring: body.exploring?.trim() || null,
        next_focus: body.next_focus?.trim() || null,
        share_publicly: body.share_publicly,
      })
      .select("id, created_at")
      .single();
    if (error || !log) return dbError(error, "learning-log");

    // The share: paragraph only, metrics never travel (backend doc §6).
    // Service client — profile_updates has no client INSERT policy.
    let shared = false;
    if (body.share_publicly) {
      const paragraph = sharedParagraph(body);
      if (paragraph) {
        const { error: shareError } = await service
          .from("profile_updates")
          .insert({
            participant_id: participantId,
            learning_log_id: log.id,
            body: paragraph,
          });
        shared = !shareError;
        if (shareError) console.error("[learning-log] share failed:", shareError.message);
      }
    }

    return NextResponse.json(
      { saved: true, shared, gate_cleared: gateBefore.active },
      { status: 201 }
    );
  }
);

// The member's own recent logs + count — feeds the card's history list.
export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json({ logs: [], count: 0 });
    }
    const { data: logs, count } = await auth.supabase
      .from("learning_logs")
      .select(
        "id, kind, clarity, alignment, is_blocked, accomplished, exploring, next_focus, share_publicly, created_at",
        { count: "exact" }
      )
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(10);
    return NextResponse.json({ logs: logs ?? [], count: count ?? 0 });
  }
);
