import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { getFieldSurveyBySlug, getFieldSurveyQuestions } from "@/lib/content/surveys";
import { createQuestionSchema } from "@/lib/validations/survey-question";

// Question builder — list + create. Admin only; service-role writes
// (survey_questions has no write policy, and drafts aren't visible to the
// RLS client).

export const GET = withAdminAuth(async (_request, _auth, params) => {
  const survey = await getFieldSurveyBySlug(params.slug);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  const questions = await getFieldSurveyQuestions(survey.id, {
    includeInactive: true,
  });
  return NextResponse.json(questions);
});

export const POST = withAdminAuth(async (request, _auth, params) => {
  const survey = await getFieldSurveyBySlug(params.slug);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const body = await parseBody(request, createQuestionSchema);
  if (isErrorResponse(body)) return body;

  const supabase = createServiceClient();
  // Append at the end.
  const { data: last } = await supabase
    .from("survey_questions")
    .select("position")
    .eq("field_survey_id", survey.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("survey_questions")
    .insert({
      field_survey_id: survey.id,
      position,
      question_key: `q_${crypto.randomUUID().slice(0, 8)}`,
      question_type: body.question_type,
      prompt: body.prompt,
      help: body.help ?? null,
      placeholder: body.placeholder ?? null,
      required: body.required ?? false,
      config: body.config ?? {},
      response_column: null,
      is_system: false,
    })
    .select("id")
    .single();
  if (error) return dbError(error, "survey-question-create");

  return NextResponse.json(data, { status: 201 });
});
