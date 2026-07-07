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
// kind is always derived server-side. cycle_id used to be too — the single
// active enrollment decided it — but org cycles (migration 00060) mean a
// member can hold an active enrollment in more than one active cycle at
// once (dual-enrolled staff file one log per cycle). The client MAY send
// cycle_id as a hint in the body; it's validated here against the member's
// own active enrollments in active cycles, never trusted as-is. With none
// sent: a single eligible cycle is chosen automatically; several fall back
// to the mode='open' one (the old single-cycle behavior); zero is a
// standalone log (cycle_id NULL, unchanged).

interface EligibleCycle {
  id: number;
  name: string;
  mode: string;
  start_date: string | null;
  end_date: string | null;
}

async function resolveEligibleCycles(
  service: ReturnType<typeof createServiceClient>,
  participantId: number
): Promise<EligibleCycle[]> {
  const { data: activeCycles } = await service
    .from("cycles")
    .select("id, name, mode, start_date, end_date")
    .eq("status", "active");
  if (!activeCycles || activeCycles.length === 0) return [];

  const { data: enrollments } = await service
    .from("cycle_enrollments")
    .select("cycle_id")
    .eq("participant_id", participantId)
    .eq("status", "active")
    .in(
      "cycle_id",
      activeCycles.map((c) => c.id)
    );
  const enrolledIds = new Set((enrollments ?? []).map((e) => e.cycle_id));
  return activeCycles.filter((c) => enrolledIds.has(c.id));
}

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

    // Read the gate BEFORE the write: "cleared" means "you were locked and
    // now you're not" — never a false "you're back in ✓" for members who
    // were never locked.
    const gateBefore = await learningLogGate(participantId);

    const body = await parseBody(request, learningLogSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const eligibleCycles = await resolveEligibleCycles(service, participantId);

    let chosenCycle: EligibleCycle | null = null;
    if (body.cycle_id != null) {
      chosenCycle = eligibleCycles.find((c) => c.id === body.cycle_id) ?? null;
      if (!chosenCycle) {
        return NextResponse.json(
          {
            error:
              "cycle_id must be one of your active enrollments in an active cycle",
          },
          { status: 400 }
        );
      }
    } else if (eligibleCycles.length === 1) {
      chosenCycle = eligibleCycles[0];
    } else if (eligibleCycles.length > 1) {
      // Legacy single-cycle behavior when the client doesn't say which one:
      // prefer the participant cycle over the org cycle.
      chosenCycle =
        eligibleCycles.find((c) => c.mode === "open") ?? eligibleCycles[0];
    }

    let kind: "weekly" | MilestoneKind = "weekly";
    if (chosenCycle) {
      // Milestone weeks are admin-configurable (cycle_config, 00047); if the
      // chosen cycle's current week matches one, this log is that evaluation.
      const { data: cfg } = await service
        .from("cycle_config")
        .select("milestone_mid_week, milestone_final_week")
        .eq("cycle_id", chosenCycle.id)
        .maybeSingle();
      if (cfg && chosenCycle.start_date && chosenCycle.end_date) {
        const week = getCycleWeek(
          new Date(),
          new Date(chosenCycle.start_date),
          new Date(chosenCycle.end_date)
        );
        kind = milestoneKindForWeek(week, cfg) ?? "weekly";
      }
    }

    const { data: log, error } = await auth.supabase
      .from("learning_logs")
      .insert({
        participant_id: participantId,
        cycle_id: chosenCycle?.id ?? null,
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

    // Read the gate AFTER the write too: saving only clears the cycle this
    // log is attributed to (lib/learning-logs/gate-logic.ts), so a
    // dual-enrolled member with another still-pending cycle stays locked —
    // "cleared" means every previously-pending cycle is now met, not just
    // "a log exists".
    const gateAfter = await learningLogGate(participantId);

    return NextResponse.json(
      {
        saved: true,
        shared,
        gate_cleared: gateBefore.active && !gateAfter.active,
      },
      { status: 201 }
    );
  }
);

// The member's own logs + count — feeds the card's reviewable history. The
// Learning Log is a journaling practice, so this is the member's record to
// look back on; the card renders these newest-first, expandable. (A dedicated
// paginated journal view is a follow-up if a heavy journaler exceeds this.)
export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json({ logs: [], count: 0 });
    }
    const { data: logs, count } = await auth.supabase
      .from("learning_logs")
      .select(
        "id, cycle_id, kind, clarity, alignment, is_blocked, accomplished, exploring, next_focus, share_publicly, created_at",
        { count: "exact" }
      )
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(50);
    return NextResponse.json({ logs: logs ?? [], count: count ?? 0 });
  }
);
