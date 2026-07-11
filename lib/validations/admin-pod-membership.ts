import { z } from "zod";

/**
 * Body schema for POST /api/admin/pods/[pod_id]/memberships.
 * The admin supplies a participant_id; pod_id comes from the route param.
 * pod_role is required for organization workstream runs and rejected
 * elsewhere (same contract as POST /api/invitations) — the route enforces
 * that pairing because it depends on the pod's cycle mode.
 */
export const adminAddPodMembershipSchema = z.object({
  participant_id: z.number().int().positive(),
  pod_role: z.enum(["co_lead", "member"]).optional(),
});

export type AdminAddPodMembership = z.infer<typeof adminAddPodMembershipSchema>;
