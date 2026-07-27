import { z } from "zod";

/* Validation for admin-authored member tasks (custom_tasks, 00093 —
   /admin/tasks + /api/admin/tasks). Timestamps arrive as the naive-UTC
   strings fromLabInput produces (the S5.1 storage convention). */

const hrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (v) => v.startsWith("/") || v.startsWith("#") || /^https?:\/\//i.test(v),
    "Link must be an app path (/…), an anchor (#…), or an http(s) URL"
  );

const timestampSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(/Z|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v}Z`)), {
    message: "Not a valid timestamp",
  });

export const customTaskCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    detail: z.string().trim().max(1000).nullable().optional(),
    href: hrefSchema,
    cta: z.string().trim().max(40).nullable().optional(),
    cycle_id: z.number().int().positive().nullable().optional(),
    starts_at: timestampSchema.nullable().optional(),
    ends_at: timestampSchema.nullable().optional(),
    pinned: z.boolean().optional(),
    dismissible: z.boolean().optional(),
  })
  .refine(
    (v) =>
      !v.starts_at ||
      !v.ends_at ||
      Date.parse(v.starts_at) < Date.parse(v.ends_at),
    { message: "ends_at must be after starts_at", path: ["ends_at"] }
  );

export const customTaskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    detail: z.string().trim().max(1000).nullable().optional(),
    href: hrefSchema.optional(),
    cta: z.string().trim().max(40).nullable().optional(),
    cycle_id: z.number().int().positive().nullable().optional(),
    starts_at: timestampSchema.nullable().optional(),
    ends_at: timestampSchema.nullable().optional(),
    pinned: z.boolean().optional(),
    dismissible: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Empty update" });
