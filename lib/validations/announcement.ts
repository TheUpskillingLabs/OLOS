import { z } from "zod";

// Admin authoring of an org announcement (the /admin/announcements surface).
// Create requires title + body; PATCH sends only what changed. lab_id null =
// global/org-wide, a positive int scopes to one lab (metros). Publishing
// (status → 'published') is where the route stamps published_at.
//
// Scheduling (00104): published_at is the go-live time — a future value on a
// published row schedules it. expires_at auto-archives the row; null = never
// expires, omitted on create = two weeks from now. Both are ISO timestamps
// with an offset (the client converts its datetime-local inputs).
const timestamp = z.iso.datetime({ offset: true }).nullable().optional();

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  lab_id: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  pinned: z.boolean().optional(),
  published_at: timestamp,
  expires_at: timestamp,
});

export const announcementPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  lab_id: z.number().int().positive().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  pinned: z.boolean().optional(),
  published_at: timestamp,
  expires_at: timestamp,
});

export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;
export type AnnouncementPatchInput = z.infer<typeof announcementPatchSchema>;
