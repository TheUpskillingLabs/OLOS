import { z } from "zod";

// Admin authoring of an org announcement (the /admin/announcements surface).
// Create requires title + body; PATCH sends only what changed. lab_id null =
// global/org-wide, a positive int scopes to one lab (metros). Publishing
// (status → 'published') is where the route stamps published_at.
export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  lab_id: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  pinned: z.boolean().optional(),
});

export const announcementPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  lab_id: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  pinned: z.boolean().optional(),
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
export type AnnouncementPatchInput = z.infer<typeof announcementPatchSchema>;
