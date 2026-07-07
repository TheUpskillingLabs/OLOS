import { z } from "zod";

/**
 * Validation for the showcase-page + social-graph feature (migrations 00060/00061).
 * Shared by the follow toggle, the pod/project page PATCH, and the entity-links
 * CRUD routes.
 */

// The polymorphic entity vocabulary — same set for follow targets and link owners.
export const ENTITY_TYPES = ["participant", "pod", "project", "cycle"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// Follow toggle body. Self-follow (a participant following their own profile) is
// rejected in the route AND by a DB CHECK (defense in depth).
export const followToggleSchema = z.object({
  target_type: z.enum(ENTITY_TYPES),
  target_id: z.number().int().positive(),
});
export type FollowToggleInput = z.infer<typeof followToggleSchema>;

// Curated showcase text for a pod/project page. logo_url / cover_url are
// deliberately NOT here — images are written only by the image-upload route, so
// a curator can never point them at an arbitrary <img src> (XSS/SSRF footgun).
export const showcasePageSchema = z.object({
  tagline: z
    .string()
    .trim()
    .max(200, "Tagline must be 200 characters or fewer")
    .nullish(),
  description: z
    .string()
    .trim()
    .max(4000, "Description must be 4000 characters or fewer")
    .nullish(),
  directory_visible: z.boolean().optional(),
});
export type ShowcasePageInput = z.infer<typeof showcasePageSchema>;

// External/social links. One row per platform per owner (DB UNIQUE).
export const LINK_PLATFORMS = [
  "github",
  "linkedin",
  "x",
  "website",
  "youtube",
  "instagram",
  "discord",
  "other",
] as const;
export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

// http/https only. These URLs render as raw <a href>, so the scheme IS the
// security boundary — reject javascript:, data:, mailto:, etc.
const httpUrl = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(500, "URL is too long")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Link must be a valid http:// or https:// URL");

export const entityLinkCreateSchema = z.object({
  owner_type: z.enum(ENTITY_TYPES),
  owner_id: z.number().int().positive(),
  platform: z.enum(LINK_PLATFORMS),
  url: httpUrl,
  label: z.string().trim().max(80).nullish(),
});
export type EntityLinkCreateInput = z.infer<typeof entityLinkCreateSchema>;

export const entityLinkDeleteSchema = z.object({
  owner_type: z.enum(ENTITY_TYPES),
  owner_id: z.number().int().positive(),
  platform: z.enum(LINK_PLATFORMS),
});
export type EntityLinkDeleteInput = z.infer<typeof entityLinkDeleteSchema>;
