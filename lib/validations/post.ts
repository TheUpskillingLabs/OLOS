import { z } from "zod";

// A freeform member post (the feed composer). `visibility` is the audience:
// "public" → the members-wide community feed (profile_updates 'labs'),
// "private" → author-only. Mapped to the DB visibility values in the route.
//
// `as` (optional) posts the update AS a page (a lab/sector/workstream/pod/
// project) instead of as yourself — allowed only when the session participant
// is an admin of that page (checked in the route). Page posts are always public.
export const postCreateSchema = z.object({
  body: z.string().trim().min(1).max(3000),
  visibility: z.enum(["public", "private"]).default("public"),
  as: z
    .object({
      type: z.enum(["lab", "sector", "workstream", "pod", "project"]),
      id: z.number().int().positive(),
    })
    .optional(),
});

export type PostCreateInput = z.infer<typeof postCreateSchema>;
