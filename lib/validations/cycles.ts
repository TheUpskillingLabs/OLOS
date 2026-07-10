import { z } from "zod";

export const createCycleSchema = z.object({
  name: z.string().min(1, "Cycle name is required").max(200),
  slug: z.string().max(200).optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
});

// Cycle "About" / information-page content (admin-authored, optional).
export const updateCycleDetailsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  what_you_build: z.string().max(5000).nullable().optional(),
  // Metro/region assignment — scopes a local labs lead to this cycle.
  metro_slug: z.string().max(50).nullable().optional(),
});

export const updateCycleConfigSchema = z.object({
  submitter_votes: z.number().int().min(0).optional(),
  non_submitter_votes: z.number().int().min(0).optional(),
  vote_threshold: z.number().int().min(0).optional(),
  max_pods: z.number().int().min(1).optional(),
  pod_min: z.number().int().min(1).optional(),
  pod_limit: z.number().int().min(1).optional(),
  project_submitter_votes: z.number().int().min(0).optional(),
  project_vote_threshold: z.number().int().min(0).optional(),
  max_projects: z.number().int().min(1).optional(),
  project_min: z.number().int().min(1).optional(),
  project_max: z.number().int().min(1).optional(),
  problem_statement_open: z.string().nullable().optional(),
  problem_statement_close: z.string().nullable().optional(),
  voting_open: z.string().nullable().optional(),
  voting_close: z.string().nullable().optional(),
  pod_registration_open: z.string().nullable().optional(),
  pod_registration_close: z.string().nullable().optional(),
  solution_proposal_open: z.string().nullable().optional(),
  solution_proposal_close: z.string().nullable().optional(),
  solution_voting_open: z.string().nullable().optional(),
  solution_voting_close: z.string().nullable().optional(),
  project_registration_open: z.string().nullable().optional(),
  project_registration_close: z.string().nullable().optional(),
  registration_open: z.string().nullable().optional(),
  registration_close: z.string().nullable().optional(),
});

export const updateCycleStatusSchema = z.object({
  status: z.enum(
    ["draft", "upcoming", "active", "closing", "archived", "closed"],
    {
      message:
        'status must be one of: "draft", "upcoming", "active", "closing", "archived", "closed"',
    }
  ),
});
