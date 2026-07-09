import { z } from "zod";

// Add a member as an explicit admin of a page, by their @handle.
export const pageAdminAddSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .transform((h) => h.replace(/^@/, "").toLowerCase()),
});

export type PageAdminAddInput = z.infer<typeof pageAdminAddSchema>;
