import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { pulseCheckWithNominationsSchema } from "@/lib/validations/pulse-checks";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, pulseCheckWithNominationsSchema);
    if (isErrorResponse(body)) return body;
    const {
      cycle_id,
      pod_id,
      project_id,
      scheduled_date,
      survey_responses,
      nominations,
    } = body;
    const participant_id = auth.user.participantId;

    if (!participant_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

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

    const completed_at = new Date().toISOString();

    const { data: pulseCheck, error } = await auth.supabase
      .from("pulse_checks")
      .insert({
        cycle_id: cycle_id || null,
        participant_id,
        scheduled_date,
        completed_at,
        survey_responses: {
          ...survey_responses,
          ...(pod_id ? { pod_id } : {}),
          ...(project_id ? { project_id } : {}),
        },
      })
      .select("id, completed_at")
      .single();

    if (error) {
      return dbError(error);
    }

    let nominationCount = 0;
    if (nominations && nominations.length > 0) {
      const rows = nominations.map((n) => ({
        participant_id,
        pulse_check_id: pulseCheck.id,
        cycle_id: cycle_id || null,
        nominee_name: n.nominee_name,
        nominee_email: n.nominee_email || null,
        nominee_linkedin: n.nominee_linkedin || null,
        nomination_type: n.nomination_type,
        reason: n.reason,
      }));

      const { error: nomError } = await auth.supabase
        .from("nominations")
        .insert(rows);

      if (nomError) {
        return dbError(nomError);
      }
      nominationCount = rows.length;
    }

    await auth.supabase
      .from("participants")
      .update({ last_pulse_completed_at: completed_at })
      .eq("id", participant_id);

    return NextResponse.json(
      {
        id: pulseCheck.id,
        completed_at: pulseCheck.completed_at,
        nomination_count: nominationCount,
      },
      { status: 201 }
    );
  }
);
