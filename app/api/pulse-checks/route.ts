import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await request.json();
    const { cycle_id, scheduled_date, survey_responses } = body;
    const participant_id = auth.user.participantId;

    if (!participant_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    if (!cycle_id || !scheduled_date || !survey_responses) {
      return NextResponse.json(
        { error: "cycle_id, scheduled_date, and survey_responses are required" },
        { status: 400 }
      );
    }

    // Validate accomplishment (required)
    if (!survey_responses.accomplishment || typeof survey_responses.accomplishment !== "string" || survey_responses.accomplishment.length === 0) {
      return NextResponse.json(
        { error: "survey_responses.accomplishment is required" },
        { status: 400 }
      );
    }

    if (survey_responses.accomplishment.length > 1000) {
      return NextResponse.json(
        { error: "accomplishment must be 1000 characters or fewer" },
        { status: 400 }
      );
    }

    // Validate benefits max 3
    if (survey_responses.benefits && survey_responses.benefits.length > 3) {
      return NextResponse.json(
        { error: "benefits must contain at most 3 items" },
        { status: 400 }
      );
    }

    // Check for duplicate submission
    const { data: existing } = await auth.supabase
      .from("pulse_checks")
      .select("id")
      .eq("cycle_id", cycle_id)
      .eq("participant_id", participant_id)
      .eq("scheduled_date", scheduled_date)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted a pulse check for this date" },
        { status: 409 }
      );
    }

    const { data, error } = await auth.supabase
      .from("pulse_checks")
      .insert({
        cycle_id,
        participant_id,
        scheduled_date,
        completed_at: new Date().toISOString(),
        survey_responses,
      })
      .select("id, completed_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
