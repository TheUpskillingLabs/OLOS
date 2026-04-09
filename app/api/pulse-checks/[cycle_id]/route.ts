import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseInt(params.cycle_id);
    const participantId = request.nextUrl.searchParams.get("participant_id");

    const targetId = participantId
      ? parseInt(participantId)
      : auth.user.participantId;

    if (!targetId) {
      return NextResponse.json({ error: "participant_id required" }, { status: 400 });
    }

    // Non-admins can only see their own
    if (targetId !== auth.user.participantId && !isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await auth.supabase
      .from("pulse_checks")
      .select("scheduled_date, completed_at, survey_responses")
      .eq("cycle_id", cycleId)
      .eq("participant_id", targetId)
      .order("scheduled_date");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }
);
