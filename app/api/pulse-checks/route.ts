import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { pulseCheckSchema } from "@/lib/validations/pulse-checks";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, pulseCheckSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id, scheduled_date, survey_responses } = body;
    const participant_id = auth.user.participantId;

    if (!participant_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Check for duplicate submission
    const dupeQuery = auth.supabase
      .from("pulse_checks")
      .select("id")
      .eq("participant_id", participant_id)
      .eq("scheduled_date", scheduled_date);

    if (cycle_id) {
      dupeQuery.eq("cycle_id", cycle_id);
    } else {
      dupeQuery.is("cycle_id", null);
    }

    const { data: existing } = await dupeQuery.maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted a pulse check for this date" },
        { status: 409 }
      );
    }

    const { data, error } = await auth.supabase
      .from("pulse_checks")
      .insert({
        cycle_id: cycle_id || null,
        participant_id,
        scheduled_date,
        completed_at: new Date().toISOString(),
        survey_responses,
      })
      .select("id, completed_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data, { status: 201 });
  }
);
