import { z } from "zod";

/**
 * Body schema for POST /api/admin/projects/[project_id]/memberships.
 *
 * The destination project comes from the route param. For a move, the SOURCE
 * project is deliberately NOT in the body: the RPC derives it from the
 * participant's one active membership in that cycle, so a stale roster in the
 * browser can't move the wrong row.
 *
 * `override` exceeds cycle_config.project_max (owner decision, 2026-09-11).
 * It only takes effect for an admin, and every use is recorded in
 * admin_actions.cap_overridden.
 */
export const adminProjectMembershipSchema = z.object({
  action: z.enum(["add", "move"]),
  participant_id: z.number().int().positive(),
  reason: z.string().trim().max(500).optional(),
  override: z.boolean().optional(),
});

export type AdminProjectMembershipInput = z.infer<typeof adminProjectMembershipSchema>;
