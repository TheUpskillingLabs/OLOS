import { z } from "zod";

// A freeform member post (the feed composer). `visibility` is the audience:
// "public" → the members-wide community feed (profile_updates 'labs'),
// "private" → author-only. Mapped to the DB visibility values in the route.
export const postCreateSchema = z.object({
  body: z.string().trim().min(1).max(3000),
  visibility: z.enum(["public", "private"]).default("public"),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;
