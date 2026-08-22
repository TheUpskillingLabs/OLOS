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

// Solution-proposal (project pitch) payload — Civics & Elections project
// submissions (2026-08). name + summary land in dedicated columns; the four
// pitch questions nest into proposal_data JSONB (schema-less, so no migration).
// All four are required and capped at 1500 chars (~300 words). Migration 00016
// added name/summary and the (cycle_id, participant_id) unique index that
// enforces one submission per participant per cycle at the DB layer.
//
// NOTE: the legacy keys (description, pod_problem_link, why_now, mvp_scope,
// skills_wanted) are retired here; rows written under the old form keep them
// harmlessly in proposal_data, and read sites fall back to them for legacy rows.
const PITCH_MAX = 1500;
const pitchField = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .max(PITCH_MAX, `${label} must be ${PITCH_MAX} characters or fewer`);

export const solutionProposalSchema = z.object({
  name: z
    .string()
    .min(1, "Project name is required")
    .max(100, "Project name must be 100 characters or fewer"),
  summary: z
    .string()
    .min(1, "Summary is required")
    .max(200, "Summary must be 200 characters or fewer"),
  refined_problem_statement: pitchField("Refined problem statement"),
  project_hypothesis: pitchField("Project hypothesis"),
  target_users: pitchField("Target users"),
  the_value: pitchField("The value"),
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
  list_name: z.string().min(1, "List name is required").max(100),
  value: z.string().min(1, "Value is required").max(200),
  display_order: z.number().int().optional(),
});
