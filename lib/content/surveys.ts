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

/** A survey by its share slug regardless of status — for admin/results reads. */
export async function getFieldSurveyBySlug(
  slug: string
): Promise<FieldSurvey | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("field_surveys")
    .select(SURVEY_COLUMNS)
    .eq("share_slug", slug)
    .maybeSingle();
  return (data as FieldSurvey) ?? null;
}

/**
 * The open field survey a cycle should surface as its opening activity — the
 * participant's first CTA. Prefers a survey tied directly to the cycle
 * (`cycle_id`), falling back to the cycle's sector commons (`sector_id`).
 * Returns null when the cohort has no open survey.
 */
export async function getFieldSurveyForCycle(
  cycleId: number,
  sectorId: number | null
): Promise<FieldSurvey | null> {
  const supabase = createServiceClient();
  const { data: byCycle } = await supabase
    .from("field_surveys")
    .select(SURVEY_COLUMNS)
    .eq("cycle_id", cycleId)
    .eq("status", "open")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byCycle) return byCycle as FieldSurvey;

  if (sectorId != null) {
    const { data: bySector } = await supabase
      .from("field_surveys")
      .select(SURVEY_COLUMNS)
      .eq("sector_id", sectorId)
      .eq("status", "open")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bySector) return bySector as FieldSurvey;
  }
  return null;
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

// ── Field-survey questions (the builder-defined instrument, migration 00060) ──

export type SurveyQuestionType =
  | "short_text"
  | "long_text"
  | "single_select"
  | "multi_select"
  | "scale"
  | "yes_no"
  | "consent"
  | "contact";

/** A `config` shape covering every question type (fields are type-specific). */
export interface SurveyQuestionConfig {
  options?: { v: string; label: string }[]; // single_select, multi_select, yes_no
  min?: number; // multi_select minimum picks
  lowLabel?: string; // scale
  highLabel?: string; // scale
  fields?: { id: string; label: string; ph?: string; half?: boolean }[]; // contact
  agreementTitle?: string; // consent
  agreement?: { h: string; p: string }[]; // consent
  references?: { label: string; href: string }[]; // consent
  text?: string; // consent
}

export interface SurveyQuestion {
  id: number;
  field_survey_id: number;
  position: number;
  question_key: string;
  question_type: SurveyQuestionType;
  prompt: string;
  help: string | null;
  placeholder: string | null;
  required: boolean;
  config: SurveyQuestionConfig;
  response_column: string | null;
  is_system: boolean;
  active: boolean;
}

const QUESTION_COLUMNS =
  "id, field_survey_id, position, question_key, question_type, prompt, help, placeholder, required, config, response_column, is_system, active";

/**
 * A field survey's questions in flow order. Public reads pass the default
 * (active only); the admin builder passes { includeInactive: true } to show
 * soft-deleted rows. Service-role — survey_response_answers/questions writes
 * are service-role, and drafts aren't visible to the anon client.
 */
export async function getFieldSurveyQuestions(
  surveyId: number,
  opts: { includeInactive?: boolean } = {}
): Promise<SurveyQuestion[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from("survey_questions")
    .select(QUESTION_COLUMNS)
    .eq("field_survey_id", surveyId)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  if (!opts.includeInactive) query = query.eq("active", true);
  const { data } = await query;
  return (data as SurveyQuestion[] | null) ?? [];
}
