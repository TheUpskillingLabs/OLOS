import { z } from "zod";

const surveyResponsesSchema = z.object({
  accomplishment: z
    .string({ message: "survey_responses.accomplishment is required" })
    .min(1, "survey_responses.accomplishment is required")
    .max(1000, "accomplishment must be 1000 characters or fewer"),
  energy_level: z
    .number()
    .int("energy_level must be an integer between 1 and 5")
    .min(1, "energy_level must be an integer between 1 and 5")
    .max(5, "energy_level must be an integer between 1 and 5")
    .optional()
    .nullable(),
  highlight: z
    .string()
    .max(1000, "highlight must be 1000 characters or fewer")
    .optional()
    .nullable(),
  challenge: z
    .string()
    .max(1000, "challenge must be 1000 characters or fewer")
    .optional()
    .nullable(),
  ai_tools: z.string().max(500).optional().nullable(),
  benefits: z
    .array(z.string())
    .max(3, "benefits must contain at most 3 items")
    .optional()
    .nullable(),
  new_connections: z.number().int().min(0).optional().nullable(),
  help_needed: z.string().max(1000).optional().nullable(),
}).passthrough();

export const pulseCheckSchema = z.object({
  cycle_id: z.number().int().optional().nullable(),
  scheduled_date: z.string().min(1, "scheduled_date is required"),
  survey_responses: surveyResponsesSchema,
});
