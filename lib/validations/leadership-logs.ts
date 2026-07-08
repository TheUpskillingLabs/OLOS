import { z } from "zod";

/* The Leadership Log write shape (docs/ORG_CYCLES.md §4a; migration 00069).
   Mirrors the Learning Log's health + reflection shape, plus the scope: the
   tier and its cycle + pod (workstream_lead) or lab (lab_lead). The scope is
   authorized server-side against the participant's occupied scopes
   (app/api/leadership-logs/route.ts) — never trusted as-is. Non-blocking, so
   no share/gate fields. Strict + versioned. */

const scale = (field: string) =>
  z
    .number({ message: `${field} is required` })
    .int(`${field} must be an integer between 1 and 5`)
    .min(1, `${field} must be an integer between 1 and 5`)
    .max(5, `${field} must be an integer between 1 and 5`);

const prose = (field: string) =>
  z
    .string()
    .max(2000, `${field} must be 2000 characters or fewer`)
    .optional()
    .nullable();

export const leadershipLogSchema = z
  .object({
    tier: z.enum(["workstream_lead", "lab_lead"]),
    cycle_id: z.number().int().positive(),
    pod_id: z.number().int().positive().optional().nullable(),
    lab_id: z.number().int().positive().optional().nullable(),
    clarity: scale("clarity"),
    alignment: scale("alignment"),
    is_blocked: z.boolean().default(false),
    blocker_context: prose("blocker_context"),
    accomplished: prose("accomplished"),
    exploring: prose("exploring"),
    next_focus: prose("next_focus"),
  })
  .strict();

export type LeadershipLogInput = z.infer<typeof leadershipLogSchema>;
