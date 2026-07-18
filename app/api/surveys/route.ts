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
      cycle_id: body.cycle_id,
      sector_id: body.sector_id ?? null,
      consent_version: consentVersion,
    })
    .select("id, share_slug")
    .single();
  if (error) {
    // One survey per cycle (uq_field_surveys_cycle, 00089) — surface the
    // conflict as an actionable 409 instead of a sanitized 500. The slug's
    // own UNIQUE takes the same path.
    if (error.code === "23505") {
      const taken = error.message.includes("uq_field_surveys_cycle");
      return NextResponse.json(
        {
          error: taken
            ? "That cycle already has a survey — each cycle can have only one."
            : "That share slug is already in use.",
        },
        { status: 409 }
      );
    }
    return dbError(error, "survey-create");
  }

  return NextResponse.json(data, { status: 201 });
});
