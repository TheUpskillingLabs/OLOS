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
import {
  eligibleLogCycles,
  type EligibleLogCycle,
} from "@/lib/learning-logs/eligible";
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
//
// Eligibility itself (active cycle ∩ active enrollment) is the shared
// lib/learning-logs/eligible.ts definition — gate.ts and the dashboard use
// the same one. This route also needs the chosen cycle's start/end dates
// for milestone-week math, which eligibleLogCycles doesn't carry, so those
// are fetched separately, scoped to the single chosen cycle.

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

    // Eligibility is computed once and reused for both gate reads below —
    // filing a log never changes the enrolled-cycle set, only the per-cycle
    // counts, so gateBefore and gateAfter can share it instead of each
    // re-querying cycles + cycle_enrollments (was 3 round trips: the route's
    // own resolution plus one inside each gate call; now 1).
    const eligibleCycles = await eligibleLogCycles(participantId);

    // Read the gate BEFORE the write: "cleared" means "you were locked and
    // now you're not" — never a false "you're back in ✓" for members who
    // were never locked.
    const gateBefore = await learningLogGate(participantId, eligibleCycles);

    const body = await parseBody(request, learningLogSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();

    let chosenCycle: EligibleLogCycle | null = null;
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
    // Milestone weeks are participant-cycle semantics — cycle_config's
    // milestone_mid_week/milestone_final_week frame the OPEN cohort's
    // formation timeline. Org cycles have no such framing (the UI never
    // shows milestone copy for an org save), so an org log is always
    // 'weekly' — otherwise an org cycle's own week 6/12 would masquerade as
    // a phantom milestone evaluation.
    if (chosenCycle && chosenCycle.mode === "open") {
      // Milestone weeks are admin-configurable (cycle_config, 00047); if the
      // chosen cycle's current week matches one, this log is that evaluation.
      const [{ data: cfg }, { data: cycleDates }] = await Promise.all([
        service
          .from("cycle_config")
          .select("milestone_mid_week, milestone_final_week")
          .eq("cycle_id", chosenCycle.id)
          .maybeSingle(),
        service
          .from("cycles")
          .select("start_date, end_date")
          .eq("id", chosenCycle.id)
          .maybeSingle(),
      ]);
      if (cfg && cycleDates?.start_date && cycleDates?.end_date) {
        const week = getCycleWeek(
          new Date(),
          new Date(cycleDates.start_date),
          new Date(cycleDates.end_date)
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
    // "a log exists". Reuses the same eligibleCycles fetched above — the
    // write doesn't touch cycle_enrollments.
    const gateAfter = await learningLogGate(participantId, eligibleCycles);

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
