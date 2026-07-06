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
