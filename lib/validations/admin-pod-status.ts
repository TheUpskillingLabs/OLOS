import { z } from "zod";

/**
 * Body schema for PATCH /api/admin/pods/[pod_id].
 *
 * pods.status is constrained to 'forming' and 'active' per architecture
 * brief §Cycle-Pod-Project model. The schema reflects only the values
 * the model supports — no 'archived' / 'closed' here even though the
 * UI types union mentions them (architecture review broken edge #21
 * notes that mismatch as pre-existing dead-code; not in this scope).
 */
export const adminPodStatusSchema = z.object({
  status: z.enum(["forming", "active"]),
});

export type AdminPodStatusUpdate = z.infer<typeof adminPodStatusSchema>;
