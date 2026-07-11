import { z } from "zod";

// A comment on a community feed update (profile_updates). Short freeform reply;
// bound to the update via the route param and to the author via the session.
export const commentCreateSchema = z.object({
  body: z.string().trim().min(1).max(1500),
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
