import { z } from "zod";
import { HANDLE_RE } from "@/lib/participants/handle";

// Reject the literal placeholder value 'Unknown' (case-insensitive, trimmed)
// that scripts/migration/migrate.py wrote for participants missing name data.
const PLACEHOLDER_NAME = /^unknown$/i;

const nameField = z
  .string()
  .min(1, "cannot be empty")
  .max(100)
  .refine((s) => !PLACEHOLDER_NAME.test(s.trim()), {
    message: "cannot be 'Unknown'",
  });

// The multiselect option lists the profile editor can reconcile (the ones the
// profile actually shows). Kept in sync with option_lists.list_name.
export const EDITABLE_OPTION_LISTS = [
  "ai_tools",
  "labs_goals",
  "availability",
  "work_style",
  "group_strengths",
] as const;
export type EditableOptionList = (typeof EDITABLE_OPTION_LISTS)[number];

const optionIds = z.array(z.number().int().positive()).max(80);

/**
 * Partial-update schema for PATCH /api/participants/[participant_id].
 *
 * "The whole profile is editable" (owner ask): every field the profile surfaces
 * is here — identity, directory profile, location, professional context,
 * expertise, AI familiarity, role intents, plus the `options` map for the
 * participant_options multiselects (reconciled in the route, not a column).
 *
 * - `.partial()` — PATCH semantic: send only what changed.
 * - `.strict()` — rejects unknown keys, so sensitive fields (email,
 *   auth_user_id, google_id, id, is_staff/is_test, created_at) can't be set via
 *   a tampered body. RLS 00021 is the second line of defense.
 * - NOT NULL DB columns (state, neighborhood, dcpl_card, work_situation,
 *   main_focus, ai_tool_familiarity, names) are non-nullable here; nullable
 *   columns accept null so the member can clear them.
 */
export const participantsUpdateSchema = z
  .object({
    // Identity
    first_name: nameField,
    last_name: nameField,
    preferred_name: z.string().max(100).nullable(),

    // Directory profile
    headline: z.string().max(200).nullable(),
    bio: z.string().max(2000).nullable(),
    handle: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(HANDLE_RE, "Use lowercase letters, numbers, and dashes"),

    // Location (state / neighborhood / dcpl_card are NOT NULL in the DB)
    state: z.enum(["MD", "DC", "VA", "Other"]),
    neighborhood: z.string().min(1, "cannot be empty").max(255),
    dcpl_card: z.enum(["yes", "no", "not sure"]),
    // Editing the ZIP re-derives the local lab (metro_slug) in the route.
    zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),

    // Professional context
    work_situation: z.enum([
      "employed full time",
      "employed part-time",
      "self-employed",
      "unemployed and jobseeking",
      "in a career transition",
      "student",
      "prefer not to say",
    ]),
    main_focus: z.enum([
      "finding a new role",
      "building a portfolio",
      "upskilling in current field",
      "exploring new directions",
      "starting something new",
      "other",
      "n/a",
    ]),
    sector: z.string().max(255).nullable(),
    current_title: z.string().max(255).nullable(),
    linkedin: z.string().max(500).nullable(),
    primary_expertise: z.string().max(500).nullable(),

    // AI background
    ai_tool_familiarity: z.number().int().min(1).max(5),

    // What they're here for (text[] with a DB CHECK)
    role_intents: z
      .array(z.enum(["cycle", "events", "volunteer", "mentor"]))
      .max(4),

    // Multiselects backed by participant_options (reconciled in the route).
    options: z
      .object({
        ai_tools: optionIds.optional(),
        labs_goals: optionIds.optional(),
        availability: optionIds.optional(),
        work_style: optionIds.optional(),
        group_strengths: optionIds.optional(),
      })
      .strict()
      .optional(),
  })
  .partial()
  .strict();

export type ParticipantsUpdate = z.infer<typeof participantsUpdateSchema>;
