import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { getFieldSurveyBySlug } from "@/lib/content/surveys";
import { updateQuestionSchema } from "@/lib/validations/survey-question";

// Question builder — edit + delete a single question. System questions (the
// seeded 7) are locked: their type/config/response_column back downstream
// column readers and the coverage signal, so only copy (prompt/help/
// placeholder) is editable and they can't be deleted.

export const PATCH = withAdminAuth(async (request, _auth, params) => {
  const survey = await getFieldSurveyBySlug(params.slug);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  const questionId = parseIntParam(params.question_id, "question_id");
  if (isErrorResponse(questionId)) return questionId;

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("survey_questions")
    .select("id, is_system, field_survey_id")
    .eq("id", questionId)
    .maybeSingle();
  if (!existing || existing.field_survey_id !== survey.id) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const body = await parseBody(request, updateQuestionSchema);
  if (isErrorResponse(body)) return body;

  const update: Record<string, unknown> = {};
  if (body.prompt !== undefined) update.prompt = body.prompt;
  if (body.help !== undefined) update.help = body.help;
  if (body.placeholder !== undefined) update.placeholder = body.placeholder;
  // Type, options/config, and required are locked on system questions.
  if (!existing.is_system) {
    if (body.question_type !== undefined) update.question_type = body.question_type;
    if (body.config !== undefined) update.config = body.config;
    if (body.required !== undefined) update.required = body.required;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase
    .from("survey_questions")
    .update(update)
    .eq("id", questionId);
  if (error) return dbError(error, "survey-question-update");

  return NextResponse.json({ ok: true });
});

export const DELETE = withAdminAuth(async (_request, _auth, params) => {
  const survey = await getFieldSurveyBySlug(params.slug);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }
  const questionId = parseIntParam(params.question_id, "question_id");
  if (isErrorResponse(questionId)) return questionId;

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("survey_questions")
    .select("id, is_system, field_survey_id")
    .eq("id", questionId)
    .maybeSingle();
  if (!existing || existing.field_survey_id !== survey.id) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  if (existing.is_system) {
    return NextResponse.json(
      { error: "System questions can't be deleted." },
      { status: 403 }
    );
  }

  // Soft-delete when responses reference it (keep historical answers), else
  // hard-delete.
  const { count } = await supabase
    .from("survey_response_answers")
    .select("id", { head: true, count: "exact" })
    .eq("question_id", questionId);

  const { error } =
    (count ?? 0) > 0
      ? await supabase
          .from("survey_questions")
          .update({ active: false })
          .eq("id", questionId)
      : await supabase.from("survey_questions").delete().eq("id", questionId);
  if (error) return dbError(error, "survey-question-delete");

  return NextResponse.json({ ok: true });
});
