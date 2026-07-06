import { z } from "zod";

// Field-survey observation submission (SENSEMAKING_FLOW.md §3). Public and
// anon-capable: only the observation body and participation consent are
// required — everything else (standpoint, salience, prior attempts, contact)
// is optional, mirroring the Google Form this replaces. Enforced server-side
// by POST /api/surveys/[slug]/responses; consent_version is stamped from the
// field_surveys row, never trusted from the client.

// Structured standpoints — feed the coverage/diversity signal, never a
// credibility weight (ORTELIUS_NORTHSTAR.md §6). Values are stable keys; the
// form owns their display labels.
export const STANDPOINTS = [
  "work_in_field",
  "affected",
  "tried_to_fix",
  "research",
  "pay_attention",
  "other",
] as const;

export const surveyResponseSchema = z.object({
  observation: z
    .string()
    .trim()
    .min(1, "Tell us what you're seeing")
    .max(8000, "That's a lot — trim it down a little"),
  // Required participation consent gates the submission — must be explicitly true.
  consent_participation: z.literal(true, {
    error: "Please confirm the consent to continue",
  }),
  standpoint: z.array(z.enum(STANDPOINTS)).max(6).optional().default([]),
  salience: z.number().int().min(1).max(5).nullable().optional(),
  prior_attempts: z.string().trim().max(4000).optional().or(z.literal("")),
  contactable: z.boolean().optional().default(false),
  mentor_interest: z.boolean().optional().default(false),
  submitter_name: z.string().trim().max(200).optional().or(z.literal("")),
  submitter_email: z
    .string()
    .trim()
    .email("That email doesn't look right")
    .max(320)
    .optional()
    .or(z.literal("")),
  submitter_phone: z.string().trim().max(40).optional().or(z.literal("")),
});

export type SurveyResponseInput = z.infer<typeof surveyResponseSchema>;
