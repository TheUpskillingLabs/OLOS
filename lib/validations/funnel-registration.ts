import { z } from "zod";

// The onboarding funnel's registration contract — the production twin of
// onboarding-proto's FLOWS('signup') payload (see docs/PROTO_TRANSLATION_PLAN.md).

// Role intent (view-role-intent multi-select). Stored on participants.role_intents.
export const ROLE_INTENTS = ["cycle", "events", "volunteer", "mentor"] as const;
export type RoleIntent = (typeof ROLE_INTENTS)[number];

// Mirrors the participants.work_situation CHECK constraint (00001) — which
// already matches the prototype's describes-you options exactly.
export const WORK_SITUATIONS = [
  "employed full time",
  "employed part-time",
  "self-employed",
  "unemployed and jobseeking",
  "in a career transition",
  "student",
  "prefer not to say",
] as const;

// "How did you hear about The Labs?" — stored on participants.source.
export const HEAR_ABOUT_SOURCES = ["referral", "invited", "event", "other"] as const;

// The Participant Agreement rendered (and scroll-gated) on the consent step.
// Bump the version whenever the agreement text changes.
// v2 (2026-07): role-universal framing + explicit incorporation of the hosted
// Terms of Service, Privacy Policy, and Code of Conduct. Pending owner/legal
// sign-off (see funnel.tsx). v1 acceptances remain valid; no backfill.
export const PARTICIPANT_AGREEMENT_VERSION = "participant-2026-07-v2";

// The Local Lab decision made at registration (docs/LOCAL_LABS.md — the
// membership spine): join an active lab, join an existing lab's waitlist, or
// start a waitlist for a new city. Active-lab membership is what unlocks cycle
// participation; the waitlist branches leave metro_id NULL.
export const labChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("join_active"), metro_id: z.number().int().positive() }),
  z.object({ kind: z.literal("join_waitlist"), metro_id: z.number().int().positive() }),
  z.object({
    kind: z.literal("start_waitlist"),
    city: z.string().trim().min(1, "Enter a city").max(100),
    st: z.string().trim().max(2).optional(),
  }),
]);

export type LabChoice = z.infer<typeof labChoiceSchema>;

// ZIP format shared by the funnel schema (server) and the funnel field
// validator (client) so the two can never drift. Accepts 5-digit or ZIP+4;
// the lab suggester only reads the first 3 digits (app/api/labs/suggest).
export const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

export const funnelRegistrationSchema = z.object({
  auth_user_id: z.string().min(1, "auth_user_id is required"),
  google_id: z.string().min(1, "google_id is required").max(200),
  email: z.string().email("Invalid email").max(320),
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  zip: z.string().regex(ZIP_REGEX, "Enter a 5-digit zip code"),
  work_situation: z.enum(WORK_SITUATIONS),
  source: z.enum(HEAR_ABOUT_SOURCES),
  referred_by: z.string().max(255).optional(),
  role_intents: z
    .array(z.enum(ROLE_INTENTS))
    .min(1, "Pick at least one way to take part"),
  contact_consent: z.literal(
    true,
    "You must agree to the Participant Agreement"
  ),
  agreement_version: z.literal(PARTICIPANT_AGREEMENT_VERSION),
  lab_choice: labChoiceSchema,
});

export type FunnelRegistration = z.infer<typeof funnelRegistrationSchema>;
