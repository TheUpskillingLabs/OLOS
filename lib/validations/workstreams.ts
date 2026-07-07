import { z } from "zod";

// workstreams.name mirrors pods.name's VARCHAR(40) — a run copies the name
// verbatim onto its pods row (docs/ORG_CYCLES.md §2), so the two must agree.
export const createWorkstreamSchema = z.object({
  name: z.string().min(1, "Workstream name is required").max(40),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  sector_id: z.number().int().positive().optional(),
});

export type CreateWorkstream = z.infer<typeof createWorkstreamSchema>;

// PATCH /api/admin/workstreams/[workstream_id] — partial update. name mirrors
// pods.name's VARCHAR(40) same as createWorkstreamSchema above (a run copies
// the name verbatim at charter time; renaming afterward does not retroactively
// rename existing run pods — see the route for details).
export const updateWorkstreamSchema = z
  .object({
    name: z.string().min(1, "Workstream name is required").max(40).optional(),
    description: z.string().nullable().optional(),
    status: z.enum(["active", "dormant"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nothing to update",
  });

export type UpdateWorkstream = z.infer<typeof updateWorkstreamSchema>;

export const createRunSchema = z.object({
  cycle_id: z.number().int().positive(),
  copy_from_cycle_id: z.number().int().positive().optional(),
});

export type CreateRun = z.infer<typeof createRunSchema>;

// Promote a participant onto a project's IC ladder (project_roles,
// migration 00060) — POST /api/projects/[project_id]/contributors.
export const addContributorSchema = z.object({
  participant_id: z.number().int().positive(),
  role: z.enum(["contributor", "dri"]).default("contributor"),
});

export type AddContributor = z.infer<typeof addContributorSchema>;

// Charter an org project directly onto a workstream run's pod — no
// solution_proposals ballot (docs/ORG_CYCLES.md §2) —
// POST /api/pods/[pod_id]/projects. github_repo_url mirrors pods.name's
// VARCHAR(255) column and is optional (empty string allowed from a form).
export const charterProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Project name is required")
    .max(40, "Project name must be 40 characters or fewer"),
  github_repo_url: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .max(255, "URL must be 255 characters or fewer")
    .optional()
    .or(z.literal("")),
});

export type CharterProject = z.infer<typeof charterProjectSchema>;
