import { z } from "zod";

// Admin edit of an event's EDITORIAL fields (the /admin/content Events
// surface). Events are a cache of the Luma calendar: the sync owns name,
// times, location, cover and luma_url, and this schema deliberately cannot
// touch them — it whitelists exactly the local-annotation fields the sync
// never writes (lib/integrations/luma.ts header contract), so an admin edit
// and a sync tick can never fight.
//
//   description — the detail page's lede (and the card teaser line)
//   body        — the numbered "What we'll cover" columns, one entry each
//   bring       — the "Bring" row (VARCHAR(255) in 00033)
//
// A PATCH sends only what changed, so every field is optional; null clears.

export const eventEditorialUpdateSchema = z.object({
  description: z.string().trim().max(600).nullable().optional(),
  body: z
    .array(z.string().trim().min(1).max(2000))
    .max(12)
    .nullable()
    .optional(),
  bring: z.string().trim().max(255).nullable().optional(),
});

export type EventEditorialUpdateInput = z.infer<
  typeof eventEditorialUpdateSchema
>;
