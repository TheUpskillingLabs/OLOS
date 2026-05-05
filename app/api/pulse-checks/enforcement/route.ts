import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const participant_id = auth.user.participantId;

    if (!participant_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const { data: participant, error } = await auth.supabase
      .from("participants")
      .select("last_pulse_completed_at, created_at")
      .eq("id", participant_id)
      .single();

    if (error || !participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const baseline = participant.last_pulse_completed_at ?? participant.created_at;
    const baselineMs = new Date(baseline).getTime();
    const deadlineMs = baselineMs + SEVEN_DAYS_MS;
    const now = Date.now();
    const msUntilDeadline = deadlineMs - now;

    let status: "ok" | "warning_3day" | "warning_1day" | "overdue";
    if (msUntilDeadline <= 0) {
      status = "overdue";
    } else if (msUntilDeadline < ONE_DAY_MS) {
      status = "warning_1day";
    } else if (msUntilDeadline <= THREE_DAYS_MS) {
      status = "warning_3day";
    } else {
      status = "ok";
    }

    const daysSinceLast = Math.floor((now - baselineMs) / ONE_DAY_MS);

    return NextResponse.json({
      last_completed_at: participant.last_pulse_completed_at,
      days_since_last: daysSinceLast,
      deadline: new Date(deadlineMs).toISOString(),
      status,
      locked: status === "overdue",
    });
  }
);
