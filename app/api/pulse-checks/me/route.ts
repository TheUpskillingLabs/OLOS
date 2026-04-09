import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;

    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const { data, error } = await auth.supabase
      .from("pulse_checks")
      .select("scheduled_date, completed_at, survey_responses")
      .eq("participant_id", participantId)
      .is("cycle_id", null)
      .order("scheduled_date", { ascending: false });

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
