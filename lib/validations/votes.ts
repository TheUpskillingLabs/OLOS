import { z } from "zod";

export const proposalDataSchema = z.object({
  about: z.object({
    background: z.string().max(500).optional(),
    experience: z.enum(["lived", "witnessed", "both"]).optional(),
  }).optional(),
  problem: z.object({
    who: z.string().min(1).max(2000),
    need: z.string().min(1).max(2000),
    barrier: z.string().min(1).max(2000),
    success: z.string().min(1).max(2000),
  }),
  statement: z.object({
    text: z.string().min(1).max(2000),
    question: z.string().min(1).max(2000),
  }),
  context: z.object({
    impact_track: z.string().max(200).optional(),
    theme_alignment: z.enum(["none", "direct", "adjacent"]).optional(),
    theme_connection: z.string().max(1000).optional(),
  }).optional(),
  voter_context: z.object({
    tried: z.string().max(2000).optional(),
    scale: z.string().max(2000).optional(),
    pod_work: z.string().max(2000).optional(),
    skills_needed: z.string().max(2000).optional(),
  }).optional(),
  checklist: z.object({
    real_person: z.boolean(),
    action_not_thing: z.boolean(),
    no_solution: z.boolean(),
    specific_outcome: z.boolean(),
    same_picture: z.boolean(),
  }).optional(),
});

export const problemStatementSchema = z.object({
  cycle_id: z.number().int({ message: "cycle_id must be a number" }),
  statement_text: z
    .string()
    .min(1, "statement_text is required")
    .max(5000, "statement_text must be 5000 characters or fewer"),
  proposal_data: proposalDataSchema.optional(),
});

export const voteSchema = z.object({
  cycle_id: z.number().int({ message: "cycle_id must be a number" }),
  problem_statement_id: z.number().int({
    message: "problem_statement_id must be a number",
  }),
  vote_count: z
    .number()
    .int()
    .min(1, "vote_count must be >= 1"),
});
