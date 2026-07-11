import { createServiceClient } from "@/lib/supabase/server";
import { getFieldSurveyQuestions, type SurveyQuestion } from "./surveys";
import type { CsvColumn } from "@/lib/export/csv";

// Field-survey results reads (SENSEMAKING_FLOW §3). Two surfaces:
//   - the full response table + CSV pivot (admins + assigned poderators), and
//   - the anonymized aggregate (registered cycle participants).
// All reads are service-role: survey_responses/survey_response_answers have RLS
// enabled with no read policy, so the RLS-bound client returns nothing.

// The envelope columns the table/CSV reads. Contact fields are included for the
// admin/poderator export; the participant aggregate never selects them.
const RESPONSE_COLUMNS =
  "id, created_at, moderation_status, participant_id, consent_version, observation, standpoint, salience, prior_attempts, contactable, submitter_name, submitter_email, submitter_phone, mentor_interest";

export interface SurveyResponseRow {
  id: number;
  created_at: string;
  moderation_status: "pending" | "approved" | "rejected";
  participant_id: number | null;
  consent_version: string;
  observation: string | null;
  standpoint: string[];
  salience: number | null;
  prior_attempts: string | null;
  contactable: boolean;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_phone: string | null;
  mentor_interest: boolean;
}

export interface SurveyExportData {
  questions: SurveyQuestion[];
  responses: SurveyResponseRow[];
  answersByResponse: Map<number, Map<number, unknown>>;
}

/** Load everything needed to pivot a survey's responses to a table/CSV. */
export async function getSurveyExportData(
  surveyId: number
): Promise<SurveyExportData> {
  const supabase = createServiceClient();
  const questions = await getFieldSurveyQuestions(surveyId, {
    includeInactive: true,
  });
  const { data } = await supabase
    .from("survey_responses")
    .select(RESPONSE_COLUMNS)
    .eq("field_survey_id", surveyId)
    .order("created_at", { ascending: true });
  const responses = (data as SurveyResponseRow[] | null) ?? [];

  const answersByResponse = new Map<number, Map<number, unknown>>();
  const ids = responses.map((r) => r.id);
  if (ids.length > 0) {
    const { data: answers } = await supabase
      .from("survey_response_answers")
      .select("response_id, question_id, value")
      .in("response_id", ids);
    for (const a of answers ?? []) {
      let byQuestion = answersByResponse.get(a.response_id as number);
      if (!byQuestion) {
        byQuestion = new Map();
        answersByResponse.set(a.response_id as number, byQuestion);
      }
      byQuestion.set(a.question_id as number, a.value);
    }
  }

  return { questions, responses, answersByResponse };
}

/**
 * Pivot export data into flat CSV columns + records — one column per question
 * (a contact question expands to name/email/phone), preceded by envelope
 * columns. Works uniformly across legacy-column answers and generic answer rows.
 */
export function buildSurveyExportTable(data: SurveyExportData): {
  columns: CsvColumn[];
  records: Record<string, unknown>[];
} {
  const columns: CsvColumn[] = [
    { key: "id", header: "Response ID" },
    { key: "created_at", header: "Submitted at" },
    { key: "moderation_status", header: "Moderation status" },
    { key: "participant_id", header: "Participant ID" },
    { key: "consent_version", header: "Consent version" },
  ];
  for (const q of data.questions) {
    if (q.question_type === "contact") {
      columns.push({ key: `q${q.id}_name`, header: `${q.prompt} — Name` });
      columns.push({ key: `q${q.id}_email`, header: `${q.prompt} — Email` });
      columns.push({ key: `q${q.id}_phone`, header: `${q.prompt} — Phone` });
    } else {
      columns.push({ key: `q${q.id}`, header: q.prompt });
    }
  }

  const records = data.responses.map((r) => {
    const rec: Record<string, unknown> = {
      id: r.id,
      created_at: r.created_at,
      moderation_status: r.moderation_status,
      participant_id: r.participant_id,
      consent_version: r.consent_version,
    };
    const answers = data.answersByResponse.get(r.id);
    for (const q of data.questions) {
      if (q.question_type === "contact") {
        rec[`q${q.id}_name`] = r.submitter_name;
        rec[`q${q.id}_email`] = r.submitter_email;
        rec[`q${q.id}_phone`] = r.submitter_phone;
      } else if (q.response_column) {
        rec[`q${q.id}`] = (r as unknown as Record<string, unknown>)[
          q.response_column
        ];
      } else {
        rec[`q${q.id}`] = answers?.get(q.id) ?? null;
      }
    }
    return rec;
  });

  return { columns, records };
}

export interface SurveyAggregate {
  total: number; // non-rejected responses
  salience: number[]; // counts indexed 0..4 for values 1..5
  standpointCounts: { key: string; label: string; count: number }[];
  observations: {
    observation: string;
    standpoint: string[];
    salience: number | null;
    created_at: string;
  }[];
}

/**
 * The privacy-safe participant view: distribution signals over non-rejected
 * responses + the approved observations only. Never selects contact fields.
 */
export async function getSurveyAggregate(
  surveyId: number,
  questions: SurveyQuestion[]
): Promise<SurveyAggregate> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("survey_responses")
    .select("observation, standpoint, salience, created_at, moderation_status")
    .eq("field_survey_id", surveyId)
    .neq("moderation_status", "rejected")
    .order("created_at", { ascending: false });
  const rows = data ?? [];

  const salience = [0, 0, 0, 0, 0];
  for (const r of rows) {
    const s = r.salience as number | null;
    if (s != null && s >= 1 && s <= 5) salience[s - 1]++;
  }

  const standpointQ = questions.find((q) => q.response_column === "standpoint");
  const standpointCounts = (standpointQ?.config.options ?? []).map((o) => ({
    key: o.v,
    label: o.label,
    count: 0,
  }));
  for (const r of rows) {
    for (const s of (r.standpoint as string[] | null) ?? []) {
      const bucket = standpointCounts.find((c) => c.key === s);
      if (bucket) bucket.count++;
    }
  }

  const observations = rows
    .filter((r) => r.moderation_status === "approved" && r.observation)
    .slice(0, 50)
    .map((r) => ({
      observation: r.observation as string,
      standpoint: (r.standpoint as string[] | null) ?? [],
      salience: r.salience as number | null,
      created_at: r.created_at as string,
    }));

  return { total: rows.length, salience, standpointCounts, observations };
}
