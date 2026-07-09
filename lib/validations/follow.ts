import { z } from "zod";

// Follow / unfollow a target — either another member ("user") or an org "page"
// (a sector, a workstream, or a local lab). `following` is the desired state, so
// the one endpoint is an idempotent toggle.
export const followToggleSchema = z.object({
  type: z.enum(["user", "sector", "workstream", "lab"]),
  id: z.number().int().positive(),
  following: z.boolean(),
});

export type FollowToggleInput = z.infer<typeof followToggleSchema>;
