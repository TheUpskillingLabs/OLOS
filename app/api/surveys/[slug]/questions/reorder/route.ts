import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { getFieldSurveyBySlug } from "@/lib/content/surveys";
import { reorderQuestionsSchema } from "@/lib/validations/survey-question";

// Question builder — reorder. Rewrites `position` contiguously from the given
// order. Admin only, service-role.
export const POST = withAdminAuth(async (request, _auth, params) => {
  const survey = await getFieldSurveyBySlug(params.slug);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const body = await parseBody(request, reorderQuestionsSchema);
  if (isErrorResponse(body)) return body;

  const supabase = createServiceClient();
  const { data: rows } = await supabase
    .from("survey_questions")
    .select("id")
    .eq("field_survey_id", survey.id);
  const valid = new Set((rows ?? []).map((r) => r.id as number));
  if (!body.orderedIds.every((id) => valid.has(id))) {
    return NextResponse.json(
      { error: "Ordered ids must all belong to this survey." },
      { status: 400 }
    );
  }

  const results = await Promise.all(
    body.orderedIds.map((id, index) =>
      supabase
        .from("survey_questions")
        .update({ position: index })
        .eq("id", id)
        .eq("field_survey_id", survey.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return dbError(failed.error, "survey-question-reorder");

  return NextResponse.json({ ok: true });
});
