import { z } from "zod";

// Admin create/edit of a Learning Library resource (the /admin/content Library
// surface). The library is a link-out catalog: each row is metadata + an
// external `url` (a view-only Google Doc, a recording, a course, …). The five
// content_type values match the CHECK in migration 00033; `status` is a free
// VARCHAR there ('published' shows publicly via resources_public_read + the
// getResources filter; 'draft' hides it), so no CHECK/migration is needed for
// the two states the admin toggles between.

export const RESOURCE_CONTENT_TYPES = [
  "guide",
  "recording",
  "template",
  "course",
  "playbook",
] as const;

// Create: title + url are the load-bearing fields; everything else is optional.
// content_type / status carry the table's defaults when omitted.
export const resourceCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  url: z.string().trim().url().max(500),
  content_type: z.enum(RESOURCE_CONTENT_TYPES).default("guide"),
  summary: z.string().trim().max(4000).nullable().optional(),
  meta: z.string().trim().max(100).nullable().optional(),
  author: z.string().trim().max(255).nullable().optional(),
  status: z.enum(["published", "draft"]).default("published"),
  // Optional override; when absent the route derives the slug from the title.
  slug: z.string().trim().min(1).max(100).optional(),
});

// Edit: a PATCH sends only what changed, so every field is optional.
export const resourceUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  url: z.string().trim().url().max(500).optional(),
  content_type: z.enum(RESOURCE_CONTENT_TYPES).optional(),
  summary: z.string().trim().max(4000).nullable().optional(),
  meta: z.string().trim().max(100).nullable().optional(),
  author: z.string().trim().max(255).nullable().optional(),
  status: z.enum(["published", "draft"]).optional(),
});

export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;
export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;
