import { z } from "zod";

/**
 * Body schema for POST /api/admin/participants/[participant_id]/reconcile.
 * The admin supplies the cycle_id; participant_id comes from the URL.
 */
export const adminReconcileSchema = z.object({
  cycle_id: z.number().int().positive(),
});

export type AdminReconcileBody = z.infer<typeof adminReconcileSchema>;
