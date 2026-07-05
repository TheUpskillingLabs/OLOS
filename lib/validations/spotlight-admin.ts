import { z } from "zod";

// Admin edit/publish of a spotlight (the /admin/stories review surface). All
// fields optional — a PATCH sends only what changed. Publishing (status →
// 'published') is where the route stamps published_at and derives a slug.
export const spotlightAdminSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  role: z.string().trim().max(200).nullable().optional(),
  tag: z.enum(["builder", "mentor", "career_changer", "other"]).optional(),
  tag_label: z.string().trim().max(60).nullable().optional(),
  quote: z.string().trim().max(2000).nullable().optional(),
  story: z.array(z.string().trim().max(4000)).max(20).optional(),
  grad: z.enum(["m-teal", "m-forest", "m-navy"]).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  status: z.enum(["submitted", "published", "hidden"]).optional(),
});

export type SpotlightAdminInput = z.infer<typeof spotlightAdminSchema>;
