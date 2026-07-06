import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { requireCompleteProfile } from "@/lib/participants/placeholder";
import { learningLogSchema } from "@/lib/validations/learning-logs";
import { learningLogGate } from "@/lib/learning-logs/gate";
import { createLearningLog, getRecentLogs } from "@/lib/learning-logs/logs";

// The Learning Log (roadmap Phase 1; backend doc §6). One POST saves the
// three-part ritual; when share_publicly is set and the reflection has content,
// the concatenated paragraph (never the metrics) lands in profile_updates.
//
// The create/read logic lives in lib/learning-logs/logs.ts so the Slack
// /learninglog slash command reuses exactly this path (issue #189) — the only
// difference is how the participant is identified (session cookie here, a
// verified slack_user_id there). cycle_id and kind are derived server-side.

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

    // Read the gate BEFORE the write: a saved log always satisfies the current
    // window, so "cleared" means "you were locked and now you're not" — never a
    // false "you're back in ✓" for members who were never locked.
    const gateBefore = await learningLogGate(participantId);

    const body = await parseBody(request, learningLogSchema);
    if (isErrorResponse(body)) return body;

    try {
      const { shared } = await createLearningLog(participantId, body);
      return NextResponse.json(
        { saved: true, shared, gate_cleared: gateBefore.active },
        { status: 201 }
      );
    } catch (e) {
      console.error(
        "[learning-log] create failed:",
        e instanceof Error ? e.message : e
      );
      return NextResponse.json(
        { error: "Failed to save learning log" },
        { status: 500 }
      );
    }
  }
);

// The member's own logs + count — feeds the card's reviewable history, rendered
// newest-first and expandable.
export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) return NextResponse.json({ logs: [], count: 0 });
    const { logs, count } = await getRecentLogs(participantId, 50);
    return NextResponse.json({ logs, count });
  }
);
