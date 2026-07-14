import { z } from "zod";

export const createCycleSchema = z.object({
  name: z.string().min(1, "Cycle name is required").max(200),
  slug: z.string().max(200).optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  // 'closed' (B2B) deliberately not creatable here — SECTOR_MODEL.md §10
  // defers that track. Defaults to 'open' at the route.
  mode: z.enum(["open", "org"]).optional(),
  sector_id: z.number().int().positive().optional(),
  // Local Labs (docs/LOCAL_LABS.md): the metro this cycle belongs to.
  // Absent = HQ/global stream.
  lab_id: z.number().int().positive().optional(),
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
  project_max: z.number().int().min(1).optional(),
  // Milestone evaluation weeks (0–12; migration 00047). Admin-configurable.
  milestone_mid_week: z.number().int().min(0).max(12).optional(),
  milestone_final_week: z.number().int().min(0).max(12).optional(),
  // Per-cycle theme copy for the registration ceremony's theme info screen
  // (00084). Blank → generic fallback in lib/cycles/info.ts.
  theme_description: z.string().max(4000).nullable().optional(),
  // Admin gate pause — cron skips paused cycles and clears stale stamps (00040).
  log_gate_paused: z.boolean().optional(),
  // Leadership Log pause — org cycles only (00069, docs/ORG_CYCLES.md §4a).
  leadership_log_gate_paused: z.boolean().optional(),
  // Phase markers — the config form has always sent these, but they were
  // missing here, so zod silently stripped them and Meet The Pods /
  // Meet The Projects edits 200'd without writing (found testing #247;
  // phase_2_start now drives the pod_active_join window, so a silent drop
  // breaks the D-10 reopen gate).
  phase_2_start: z.string().nullable().optional(),
  phase_3_start: z.string().nullable().optional(),
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
});

/* Per-week "What's next" copy (cycle_weekly_messages, migration in flight).
   Admins set one program-global message per cycle week (0–12), shared by
   every open cycle (weekly_messages, 00088); the Learning Log POST surfaces
   the current week's message back to the member after a save. A blank/
   whitespace-only message deletes that week's row (route-side). Strict +
   capped at 13 entries (one per week). */
export const weeklyMessagesSchema = z
  .object({
    messages: z
      .array(
        z.object({
          week: z.number().int().min(0).max(12),
          message: z.string().max(4000),
        })
      )
      .max(13),
  })
  .strict();

export const updateCycleStatusSchema = z.object({
  // Cycle lifecycle (SECTOR_MODEL.md §4): draft → upcoming → active → closing →
  // archived. 'closed' retained as a legacy terminal. The status route enforces
  // which transitions are legal.
  status: z.enum(
    ["draft", "upcoming", "active", "closing", "archived", "closed"],
    {
      message:
        'status must be one of: "draft", "upcoming", "active", "closing", "archived", "closed"',
    }
  ),
});
