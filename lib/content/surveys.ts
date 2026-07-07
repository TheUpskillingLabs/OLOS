import { createServiceClient } from "@/lib/supabase/server";

// Field-survey reads (SENSEMAKING_FLOW.md §3). The public /survey/[slug] page
// renders the instrument; responses are written through the service-role API.

export interface FieldSurvey {
  id: number;
  cycle_id: number | null;
  sector_id: number | null;
  title: string;
  problem_domain: string | null;
  about: string | null;
  share_slug: string;
  status: "draft" | "open" | "closed";
  allow_anonymous: boolean;
  consent_version: string;
}

const SURVEY_COLUMNS =
  "id, cycle_id, sector_id, title, problem_domain, about, share_slug, status, allow_anonymous, consent_version";

/** An open survey by its public share slug, or null. */
export async function getOpenFieldSurvey(
  slug: string
): Promise<FieldSurvey | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("field_surveys")
    .select(SURVEY_COLUMNS)
    .eq("share_slug", slug)
    .eq("status", "open")
    .maybeSingle();
  return (data as FieldSurvey) ?? null;
}

// The campaign target the landing counter counts toward — a fixed number, not
// per-survey config (promote to a field_surveys column if that ever changes).
export const RESPONSE_GOAL = 1000;

/**
 * How many observations a field survey has collected — the live count the
 * landing shows against RESPONSE_GOAL. Excludes moderated-out (rejected) rows,
 * so it reads as real observations, not spam. Index-backed by
 * idx_survey_responses_survey; cheap under the page's force-dynamic render.
 */
export async function getFieldSurveyResponseCount(
  surveyId: number
): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("survey_responses")
    .select("id", { count: "exact", head: true })
    .eq("field_survey_id", surveyId)
    .neq("moderation_status", "rejected");
  return count ?? 0;
}
