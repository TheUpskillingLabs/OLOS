import { z } from "zod";
import { nominationSchema } from "./nominations";

const surveyResponsesSchema = z
  .object({
    accomplishment: z
      .string({ message: "survey_responses.accomplishment is required" })
      .min(1, "survey_responses.accomplishment is required")
      .max(2000, "accomplishment must be 2000 characters or fewer"),
    energy_level: z
      .number()
      .int("energy_level must be an integer between 1 and 5")
      .min(1, "energy_level must be an integer between 1 and 5")
      .max(5, "energy_level must be an integer between 1 and 5")
      .optional()
      .nullable(),
    highlight: z
      .string()
      .max(2000, "highlight must be 2000 characters or fewer")
      .optional()
      .nullable(),
    challenge: z
      .string()
      .max(2000, "challenge must be 2000 characters or fewer")
      .optional()
      .nullable(),
    blockers: z
      .string()
      .max(2000, "blockers must be 2000 characters or fewer")
      .optional()
      .nullable(),
    tailwinds: z
      .string()
      .max(2000, "tailwinds must be 2000 characters or fewer")
      .optional()
      .nullable(),
    mitigation_strategy: z
      .string()
      .max(2000, "mitigation_strategy must be 2000 characters or fewer")
      .optional()
      .nullable(),
    tools_used: z
      .array(z.string().min(1).max(100))
      .max(50)
      .optional()
      .nullable(),
    benefits: z
      .array(z.number().int())
      .max(3, "benefits must contain at most 3 items")
      .optional()
      .nullable(),
    new_connections: z
      .enum(["0", "1", "2", "3", "4", "5+"])
      .optional()
      .nullable(),
    anything_else: z
      .string()
      .max(2000, "anything_else must be 2000 characters or fewer")
      .optional()
      .nullable(),
  })
  .passthrough();

export const pulseCheckSchema = z.object({
  cycle_id: z.number().int().optional().nullable(),
  pod_id: z.number().int().optional().nullable(),
  project_id: z.number().int().optional().nullable(),
  scheduled_date: z.string().min(1, "scheduled_date is required"),
  survey_responses: surveyResponsesSchema,
});

export const pulseCheckWithNominationsSchema = pulseCheckSchema.extend({
  nominations: z.array(nominationSchema).optional(),
});
