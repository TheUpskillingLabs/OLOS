import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { ambassadorProgressSchema } from "@/lib/validations/ambassador";
import { STEP_IDS } from "@/lib/ambassador/content";

/**
 * Mark one of the guide's five steps done (the step page's "Done"). The guide
 * is open to anyone signed in — people waiting on their coordinator read
 * ahead — so this needs no role, only a participant row.
 */
export const POST = withAuth(async (request: NextRequest, auth) => {
  const participantId = auth.user.participantId;
  if (!participantId) return NextResponse.json({ error: "Finish creating your account first." }, { status: 403 });
  const body = await parseBody(request, ambassadorProgressSchema);
  if (isErrorResponse(body)) return body;
  if (!STEP_IDS.includes(body.step_id)) {
    return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from("ambassador_step_progress")
    .upsert({ participant_id: participantId, step_id: body.step_id }, { onConflict: "participant_id,step_id", ignoreDuplicates: true });
  if (error) return dbError(error, "ambassador-progress");

  const { data } = await service.from("ambassador_step_progress").select("step_id").eq("participant_id", participantId);
  return NextResponse.json({ done: (data ?? []).map((r: { step_id: string }) => r.step_id) });
});
