import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import { isModeratorForCycle } from "@/lib/auth/moderator";
import { getFieldSurveyBySlug } from "@/lib/content/surveys";
import {
  getSurveyExportData,
  buildSurveyExportTable,
} from "@/lib/content/survey-results";
import { toCsv } from "@/lib/export/csv";

// Field-survey response export → CSV for the Triangulator (SENSEMAKING_FLOW §8).
// Admins and the survey's assigned poderators only (the file carries submitter
// contact info). Reads are service-role — survey_responses is RLS-locked, so
// the RLS-bound client would return nothing. Resolves the survey by slug
// regardless of status so drafts/closed surveys still export.
export const GET = withAuth(async (_request, auth, params) => {
  const survey = await getFieldSurveyBySlug(params.slug);
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const allowed =
    isAdmin(auth.user) ||
    (survey.cycle_id != null &&
      (await isModeratorForCycle(auth.user, survey.cycle_id)));
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await getSurveyExportData(survey.id);
  const { columns, records } = buildSurveyExportTable(data);
  const csv = toCsv(records, columns);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `${survey.share_slug}-responses-${date}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
