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

    // cycle_id is optional — omit it for standalone / personal reflection entries
    if (!scheduled_date || !survey_responses) {
      return NextResponse.json(
        { error: "scheduled_date and survey_responses are required" },
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

    // Validate new reflective fields
    if (survey_responses.energy_level != null) {
      const e = Number(survey_responses.energy_level);
      if (!Number.isInteger(e) || e < 1 || e > 5) {
        return NextResponse.json(
          { error: "energy_level must be an integer between 1 and 5" },
          { status: 400 }
        );
      }
    }

    for (const field of ["highlight", "challenge"] as const) {
      if (survey_responses[field] != null) {
        if (typeof survey_responses[field] !== "string" || survey_responses[field].length > 1000) {
          return NextResponse.json(
            { error: `${field} must be a string of 1000 characters or fewer` },
            { status: 400 }
          );
        }
      }
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
