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

export const createRunSchema = z.object({
  cycle_id: z.number().int().positive(),
  copy_from_cycle_id: z.number().int().positive().optional(),
});

export type CreateRun = z.infer<typeof createRunSchema>;
