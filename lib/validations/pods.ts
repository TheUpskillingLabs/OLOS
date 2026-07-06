import { z } from "zod";

export const nameUpdateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(40, "Name must be 40 characters or fewer")
    .refine(
      (val) => val.trim().split(/\s+/).length <= 3,
      "Name must be 3 words or fewer"
    ),
});

// Rich solution-proposal payload — W2-001 (#74). name + summary land in
// dedicated columns; description and four optional context fields nest into
// proposal_data JSONB. Migration 00016 added these columns and the
// (cycle_id, participant_id) unique index that enforces one-submission-per-
// cycle at the DB layer.
export const solutionProposalSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name must be 100 characters or fewer"),
  summary: z
    .string()
    .min(1, "Summary is required")
    .max(200, "Summary must be 200 characters or fewer"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(4000, "Description must be 4000 characters or fewer"),
  pod_problem_link: z.string().max(2000).optional(),
  why_now: z.string().max(2000).optional(),
  mvp_scope: z.string().max(2000).optional(),
  skills_wanted: z.string().max(2000).optional(),
});

export type SolutionProposalInput = z.infer<typeof solutionProposalSchema>;

// Atomic project-vote ballot — W2-001 (#74). A submitter allocates their
// entire vote budget at once. Server validates sum equals
// cycle_config.project_submitter_votes and rejects re-submissions on the
// (voter_id, solution_proposal_id, pod_id) unique constraint.
export const projectBallotSchema = z.object({
  votes: z
    .array(
      z.object({
        solution_proposal_id: z.number().int(),
        vote_count: z.number().int().min(0),
      })
    )
    .min(1, "Ballot must include at least one entry"),
});

export type ProjectBallotInput = z.infer<typeof projectBallotSchema>;

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
  // 50, not 100: option_lists.list_name is VARCHAR(50). A 51–100 char value
  // would pass zod then 500 on the DB length violation (audit fix).
  list_name: z.string().min(1, "List name is required").max(50),
  value: z.string().min(1, "Value is required").max(200),
  display_order: z.number().int().optional(),
});

export const observerRoleSchema = z.object({
  participant_id: z.number().int({
    message: "participant_id must be a number",
  }),
});
