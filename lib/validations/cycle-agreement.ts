import { z } from "zod";

// The Open Cycle Agreement signature (backend doc §2c). Bump the version
// whenever the agreement copy changes — version the copy, not just the schema.
export const OPEN_CYCLE_AGREEMENT_VERSION = "open-2026-07-v2";

export const cycleAgreementSchema = z.object({
  // read to the end + a full name, not initials (the flow engine enforces
  // the same client-side; this is the server's mirror of the gate)
  signature_name: z
    .string()
    .trim()
    .min(3, "Sign with your full name")
    .max(200)
    .refine((v) => v.includes(" "), "Sign with your full name"),
  agreement_version: z.literal(OPEN_CYCLE_AGREEMENT_VERSION),
  answers: z
    .object({
      problem: z.string().max(2000).optional(),
      level: z.string().max(100).optional(),
      goals: z.string().max(2000).optional(),
      hours: z.string().max(50).optional(),
    })
    .optional(),
});
