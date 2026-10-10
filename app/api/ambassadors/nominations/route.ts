import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { ambassadorNominationSchema } from "@/lib/validations/ambassador";

/**
 * An ambassador nominates someone (/ambassador/nominate). It goes to the
 * coordinator of the nominator's Lab (their ambassador grant's lab_id), who
 * decides and, if yes, sends a pre-approved invite. Replaces the prototype's
 * pre-filled text to the coordinator.
 */
export const POST = withAuth(async (request: NextRequest, auth) => {
  const participantId = auth.user.participantId;
  if (!participantId) return NextResponse.json({ error: "Finish creating your account first." }, { status: 403 });
  const body = await parseBody(request, ambassadorNominationSchema);
  if (isErrorResponse(body)) return body;

  const service = createServiceClient();
  const { data: roles } = await service
    .from("participant_roles")
    .select("lab_id")
    .eq("participant_id", participantId)
    .eq("role", "ambassador")
    .is("revoked_at", null)
    .limit(1);
  if (!roles || roles.length === 0) {
    return NextResponse.json({ error: "Only ambassadors can nominate." }, { status: 403 });
  }

  const { data, error } = await service
    .from("ambassador_nominations")
    .insert({
      nominator_id: participantId,
      lab_id: roles[0].lab_id,
      nominee_name: body.nominee_name,
      how_known: body.how_known || null,
      reason: body.reason,
      nominee_contact: body.nominee_contact || null,
    })
    .select("id, created_at")
    .single();
  if (error) return dbError(error, "ambassador-nomination");
  return NextResponse.json({ nomination: data }, { status: 201 });
});
