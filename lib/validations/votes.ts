import { z } from "zod";

export const problemStatementSchema = z.object({
  cycle_id: z.number().int({ message: "cycle_id must be a number" }),
  statement_text: z
    .string()
    .min(1, "statement_text is required")
    .max(2000, "statement_text must be 2000 characters or fewer"),
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
