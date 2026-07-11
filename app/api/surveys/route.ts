import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createSurveySchema } from "@/lib/validations/survey-question";

// Create a field survey (admin only, service-role). Ships as a draft with no
// questions; the builder adds them before the survey is opened.
export const POST = withAdminAuth(async (request) => {
  const body = await parseBody(request, createSurveySchema);
  if (isErrorResponse(body)) return body;

  const supabase = createServiceClient();
  const consentVersion = `v1-${new Date().toISOString().slice(0, 7)}`;
  const { data, error } = await supabase
    .from("field_surveys")
    .insert({
      title: body.title,
      problem_domain: body.problem_domain ?? null,
      about: body.about ?? null,
      share_slug: body.share_slug,
      status: body.status ?? "draft",
      allow_anonymous: body.allow_anonymous ?? true,
      cycle_id: body.cycle_id ?? null,
      sector_id: body.sector_id ?? null,
      consent_version: consentVersion,
    })
    .select("id, share_slug")
    .single();
  if (error) return dbError(error, "survey-create");

  return NextResponse.json(data, { status: 201 });
});
