import { z } from "zod";

export const nameUpdateSchema = z.object({
  name: z
    .string()
    .min(1, "name is required")
    .max(40, "name must be 40 characters or fewer")
    .refine(
      (val) => val.trim().split(/\s+/).length <= 3,
      "name must be 3 words or fewer"
    ),
});

export const solutionProposalSchema = z.object({
  proposal_text: z
    .string()
    .min(1, "proposal_text is required")
    .max(2000, "proposal_text must be 2000 characters or fewer"),
});

export const projectVoteSchema = z.object({
  solution_proposal_id: z.number().int({
    message: "solution_proposal_id must be a number",
  }),
  vote_count: z.number().int().min(1, "vote_count must be >= 1"),
});

export const moderatorAssignmentSchema = z.object({
  participant_id: z.number().int({
    message: "participant_id must be a number",
  }),
  cycle_id: z.number().int({
    message: "cycle_id must be a number",
  }),
});

export const reactivateSchema = z.object({
  cycle_id: z.number().int({
    message: "cycle_id must be a number",
  }),
});

export const createOptionSchema = z.object({
  list_name: z.string().min(1, "list_name is required").max(100),
  value: z.string().min(1, "value is required").max(200),
  display_order: z.number().int().optional(),
});

export const observerRoleSchema = z.object({
  participant_id: z.number().int({
    message: "participant_id must be a number",
  }),
});
