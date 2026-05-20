import { z } from "zod";

export const cycleInterestSchema = z.object({
  state: z.string().min(1, "state is required").max(100),
  work_situation: z.string().min(1, "work_situation is required").max(100),
  main_focus: z.string().min(1, "main_focus is required").max(200),
  sector: z.string().max(200).optional().nullable(),
  linkedin: z.string().min(1, "LinkedIn URL is required").max(500).regex(/^https?:\/\/(www\.)?linkedin\.com\/in\/.+/, "Must be a LinkedIn profile URL"),
  availability: z.array(z.number().int()).optional().nullable(),
  group_strengths: z.array(z.number().int()).optional().nullable(),
  availability_commitment: z.string().min(1, "availability_commitment is required").max(50),
});
