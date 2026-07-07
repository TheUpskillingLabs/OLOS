import { z } from "zod";
import type { SurveyQuestion } from "@/lib/content/surveys";

// Field-survey observation submission (SENSEMAKING_FLOW.md §3). Since the
// question builder (migration 00060) the instrument is data-driven, so the
// wire payload is a generic answer map keyed by question_key (plus the flat
// contact sub-field ids name/email/phone). The server loads the survey's
// questions and validates + resolves the answers against them — question
// definitions are DB truth, mirroring how consent_version is stamped from the
// field_surveys row and never trusted from the client.

// Structured standpoints — feed the coverage/diversity signal, never a
// credibility weight (ORTELIUS_NORTHSTAR.md §6). Values are stable keys; the
// question's config owns their display labels.
export const STANDPOINTS = [
  "work_in_field",
  "affected",
  "tried_to_fix",
  "research",
  "pay_attention",
  "other",
] as const;

// The wire shape: { answers: { [question_key | field_id]: value } }. Values are
// whatever the flow engine produces (string, boolean, string[]); undefined
// values are dropped by JSON.stringify before they reach us.
const answerValue = z.union([z.string(), z.boolean(), z.array(z.string())]);

export const surveySubmissionSchema = z.object({
  answers: z.record(z.string(), answerValue),
});

export type SurveySubmissionInput = z.infer<typeof surveySubmissionSchema>;

// The resolved submission envelope — the typed survey_responses columns the
// route inserts. consent_participation defaults false (NOT NULL holds even
// when the survey has no consent question); the gate only fires when a
// *required* consent question is present.
export interface ResolvedEnvelope {
  observation: string | null;
  standpoint: string[];
  salience: number | null;
  prior_attempts: string | null;
  consent_participation: boolean;
  contactable: boolean;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_phone: string | null;
  mentor_interest: boolean;
}

export interface ResolvedAnswerRow {
  question_id: number;
  value: string | number | string[];
}

export interface ResolveResult {
  envelope: ResolvedEnvelope;
  answerRows: ResolvedAnswerRow[];
  error: string | null;
}

const emailSchema = z.string().trim().email();

/**
 * Validate + coerce a generic answer map against a survey's questions. Returns
 * the typed envelope (system questions coerce into their response_column;
 * contact fans out to submitter_*), the generic answer rows (custom questions),
 * and an error string on the first violation (surfaced as the same 400 the
 * flow already renders).
 */
export function resolveSurveyResponse(
  questions: SurveyQuestion[],
  answers: Record<string, unknown>
): ResolveResult {
  const envelope: ResolvedEnvelope = {
    observation: null,
    standpoint: [],
    salience: null,
    prior_attempts: null,
    consent_participation: false,
    contactable: false,
    submitter_name: null,
    submitter_email: null,
    submitter_phone: null,
    mentor_interest: false,
  };
  const answerRows: ResolvedAnswerRow[] = [];
  const fail = (error: string): ResolveResult => ({ envelope, answerRows, error });

  for (const q of questions) {
    const raw = answers[q.question_key];
    switch (q.question_type) {
      case "short_text":
      case "long_text": {
        const v = typeof raw === "string" ? raw.trim() : "";
        if (q.required && !v) return fail(`${q.prompt} — please answer this.`);
        if (v.length > 8000) return fail(`${q.prompt} — that's a lot, trim it down.`);
        if (q.response_column === "observation") envelope.observation = v || null;
        else if (q.response_column === "prior_attempts")
          envelope.prior_attempts = v || null;
        else if (!q.response_column && v)
          answerRows.push({ question_id: q.id, value: v });
        break;
      }
      case "scale": {
        const n =
          typeof raw === "number"
            ? raw
            : typeof raw === "string" && raw
              ? Number(raw)
              : null;
        if (q.required && n == null) return fail(`${q.prompt} — please answer this.`);
        if (n != null && (!Number.isInteger(n) || n < 1 || n > 5))
          return fail(`${q.prompt} — pick a value from 1 to 5.`);
        if (q.response_column === "salience") envelope.salience = n;
        else if (!q.response_column && n != null)
          answerRows.push({ question_id: q.id, value: n });
        break;
      }
      case "single_select":
      case "yes_no": {
        const v = typeof raw === "string" ? raw : undefined;
        if (q.required && !v) return fail(`${q.prompt} — please choose an option.`);
        const opts = q.config.options ?? [];
        if (v && opts.length && !opts.some((o) => o.v === v))
          return fail(`${q.prompt} — that isn't a valid choice.`);
        if (q.response_column === "mentor_interest")
          envelope.mentor_interest = v === "yes";
        else if (!q.response_column && v)
          answerRows.push({ question_id: q.id, value: v });
        break;
      }
      case "multi_select": {
        const arr = Array.isArray(raw)
          ? raw.filter((x): x is string => typeof x === "string")
          : [];
        const opts = q.config.options ?? [];
        if (opts.length && !arr.every((x) => opts.some((o) => o.v === x)))
          return fail(`${q.prompt} — one of the selections isn't valid.`);
        const min = q.required
          ? Math.max(1, q.config.min ?? 1)
          : (q.config.min ?? 0);
        if (arr.length < min)
          return fail(`${q.prompt} — pick at least ${min}.`);
        if (q.response_column === "standpoint") {
          if (!arr.every((x) => (STANDPOINTS as readonly string[]).includes(x)))
            return fail(`${q.prompt} — one of the selections isn't valid.`);
          envelope.standpoint = arr;
        } else if (!q.response_column) {
          answerRows.push({ question_id: q.id, value: arr });
        }
        break;
      }
      case "consent": {
        const v = raw === true;
        if (q.required && !v)
          return fail("Please confirm the consent to continue.");
        if (q.response_column === "consent_participation")
          envelope.consent_participation = v;
        break;
      }
      case "contact": {
        const fields = q.config.fields ?? [];
        let name = "";
        let email = "";
        let phone = "";
        for (const f of fields) {
          const val =
            typeof answers[f.id] === "string"
              ? (answers[f.id] as string).trim()
              : "";
          if (f.id === "name") name = val;
          else if (f.id === "email") email = val;
          else if (f.id === "phone") phone = val;
        }
        if (email && !emailSchema.safeParse(email).success)
          return fail("That email doesn't look right.");
        envelope.submitter_name = name || null;
        envelope.submitter_email = email ? email.toLowerCase() : null;
        envelope.submitter_phone = phone || null;
        envelope.contactable = Boolean(name || email || phone);
        break;
      }
    }
  }

  return { envelope, answerRows, error: null };
}
