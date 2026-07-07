import { z } from "zod";

// Validation for the field-survey question builder (admin-only). The wire
// shapes for creating/editing questions and survey settings. Question content
// is DB truth; these guard what an admin can author before it lands.

export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "single_select",
  "multi_select",
  "scale",
  "yes_no",
  "consent",
  "contact",
] as const;

const optionSchema = z.object({
  v: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(200),
});

const contactFieldSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(120),
  ph: z.string().trim().max(200).optional(),
  half: z.boolean().optional(),
});

// Permissive superset of every type's config; the resolver + flow only read the
// keys relevant to a question's type, so extra keys are harmless.
const configSchema = z
  .object({
    options: z.array(optionSchema).max(30).optional(),
    min: z.number().int().min(0).max(30).optional(),
    lowLabel: z.string().trim().max(120).optional(),
    highLabel: z.string().trim().max(120).optional(),
    fields: z.array(contactFieldSchema).max(10).optional(),
    agreementTitle: z.string().trim().max(200).optional(),
    agreement: z
      .array(
        z.object({
          h: z.string().trim().max(200),
          p: z.string().trim().max(2000),
        })
      )
      .max(10)
      .optional(),
    references: z
      .array(
        z.object({
          label: z.string().trim().max(120),
          href: z.string().trim().max(500),
        })
      )
      .max(10)
      .optional(),
    text: z.string().trim().max(2000).optional(),
  })
  .strip();

export const createQuestionSchema = z.object({
  question_type: z.enum(QUESTION_TYPES),
  prompt: z.string().trim().min(1).max(500),
  help: z.string().trim().max(1000).nullable().optional(),
  placeholder: z.string().trim().max(200).nullable().optional(),
  required: z.boolean().optional().default(false),
  config: configSchema.optional(),
});

export const updateQuestionSchema = z.object({
  question_type: z.enum(QUESTION_TYPES).optional(),
  prompt: z.string().trim().min(1).max(500).optional(),
  help: z.string().trim().max(1000).nullable().optional(),
  placeholder: z.string().trim().max(200).nullable().optional(),
  required: z.boolean().optional(),
  config: configSchema.optional(),
});

export const reorderQuestionsSchema = z.object({
  orderedIds: z.array(z.number().int()).min(1).max(100),
});

const slugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only")
  .min(2)
  .max(200);

export const surveySettingsSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  problem_domain: z.string().trim().max(200).nullable().optional(),
  about: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["draft", "open", "closed"]).optional(),
  allow_anonymous: z.boolean().optional(),
  share_slug: slugSchema.optional(),
  cycle_id: z.number().int().nullable().optional(),
  sector_id: z.number().int().nullable().optional(),
});

export const createSurveySchema = z.object({
  title: z.string().trim().min(1).max(200),
  problem_domain: z.string().trim().max(200).nullable().optional(),
  about: z.string().trim().max(4000).nullable().optional(),
  share_slug: slugSchema,
  status: z.enum(["draft", "open", "closed"]).optional().default("draft"),
  allow_anonymous: z.boolean().optional().default(true),
  cycle_id: z.number().int().nullable().optional(),
  sector_id: z.number().int().nullable().optional(),
});
