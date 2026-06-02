import { z } from "zod";

/**
 * Body schema for POST /api/admin/pods/[pod_id]/memberships.
 * The admin supplies a participant_id; pod_id comes from the route param.
 */
export const adminAddPodMembershipSchema = z.object({
  participant_id: z.number().int().positive(),
});

export type AdminAddPodMembership = z.infer<typeof adminAddPodMembershipSchema>;
