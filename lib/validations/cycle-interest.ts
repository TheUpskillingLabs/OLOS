import { z } from "zod";

export const cycleInterestSchema = z.object({
  state: z.string().min(1, "State is required").max(100),
  work_situation: z.string().min(1, "Work situation is required").max(100),
  main_focus: z.string().min(1, "Main focus is required").max(200),
  sector: z.string().max(200).optional().nullable(),
  linkedin: z.string().max(500).optional().nullable(),
  availability: z.array(z.number().int()).optional().nullable(),
  group_strengths: z.array(z.number().int()).optional().nullable(),
  availability_commitment: z.string().min(1, "Availability confirmation is required").max(50),
});
