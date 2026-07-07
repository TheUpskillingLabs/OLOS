import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { getFieldSurveyBySlug } from "@/lib/content/surveys";
import { surveySettingsSchema } from "@/lib/validations/survey-question";

// Edit a field survey's settings (title/copy/status/anonymity/slug/linkage).
// Admin only, service-role. share_slug uniqueness is enforced by the DB.
export const PATCH = withAdminAuth(async (request, _auth, params) => {
  const survey = await getFieldSurveyBySlug(params.slug);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const body = await parseBody(request, surveySettingsSchema);
  if (isErrorResponse(body)) return body;

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ ok: true, share_slug: survey.share_slug });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("field_surveys")
    .update(body)
    .eq("id", survey.id)
    .select("share_slug")
    .single();
  if (error) return dbError(error, "survey-settings-update");

  return NextResponse.json({ ok: true, share_slug: data.share_slug });
});
