import { z } from "zod";

export const nominationSchema = z.object({
  nominee_name: z
    .string()
    .min(1, "nominee_name is required")
    .max(255, "nominee_name must be 255 characters or fewer"),
  nominee_email: z
    .string()
    .email("nominee_email must be a valid email")
    .optional()
    .nullable()
    .or(z.literal("")),
  nominee_linkedin: z
    .string()
    .max(500, "nominee_linkedin must be 500 characters or fewer")
    .optional()
    .nullable(),
  nomination_type: z.enum(["upskiller", "mentor", "advisor"]),
  reason: z
    .string()
    .min(1, "reason is required")
    .max(2000, "reason must be 2000 characters or fewer"),
});

export type Nomination = z.infer<typeof nominationSchema>;
