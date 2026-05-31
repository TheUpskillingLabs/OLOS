import { z } from "zod";

export const nominationSchema = z.object({
  nominee_name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be 255 characters or fewer"),
  nominee_email: z
    .string()
    .email("Must be a valid email address")
    .optional()
    .nullable()
    .or(z.literal("")),
  nominee_linkedin: z
    .string()
    .max(500, "URL must be 500 characters or fewer")
    .optional()
    .nullable(),
  nomination_type: z.enum(["upskiller", "mentor", "advisor"]),
  reason: z
    .string()
    .min(1, "Reason is required")
    .max(2000, "Reason must be 2000 characters or fewer"),
});

export type Nomination = z.infer<typeof nominationSchema>;
