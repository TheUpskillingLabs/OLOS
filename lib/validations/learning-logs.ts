import { z } from "zod";

/* The Learning Log write shape (backend doc §6; migration 00040).
   Three parts: health check (clarity/alignment 1–5 + blocked), scaffolded
   reflection (three prompts), share toggle. kind is always derived
   server-side — never trusted from the client.

   cycle_id is an OPTIONAL client hint (migration 00060 / org cycles: a
   member can hold an active enrollment in more than one active cycle at
   once, so the server can no longer always infer a single one). When
   present it's validated server-side against the member's own active
   enrollments in active cycles (app/api/learning-logs/route.ts) — never
   trusted as-is. Strict + versioned per DATA_ARCHITECTURE §2 principle 3. */

const scale = (field: string) =>
  z
    .number({ message: `${field} is required` })
    .int(`${field} must be an integer between 1 and 5`)
    .min(1, `${field} must be an integer between 1 and 5`)
    .max(5, `${field} must be an integer between 1 and 5`);

/* The Baseline Learning Log answers (lib/learning-logs/baseline.ts;
   baseline_responses migration in flight). One AI-usage frequency choice, two
   free-text outlooks, and five 1–5 readiness scales — all reusing the same
   1–5 scale helper as the weekly health check. Every answer is required —
   the outlooks must be non-empty text. Strict, so an unknown key is a
   400 rather than a silent drop. */
export const baselineSchema = z
  .object({
    ai_usage_frequency: scale("ai_usage_frequency"),
    work_shift_outlook: z
      .string()
      .trim()
      .min(1, "work_shift_outlook is required")
      .max(4000, "work_shift_outlook must be 4000 characters or fewer"),
    role_change_outlook: z
      .string()
      .trim()
      .min(1, "role_change_outlook is required")
      .max(4000, "role_change_outlook must be 4000 characters or fewer"),
    skills_readiness: scale("skills_readiness"),
    learning_confidence: scale("learning_confidence"),
    judgment_confidence: scale("judgment_confidence"),
    autonomy: scale("autonomy"),
    peer_investment: scale("peer_investment"),
  })
  .strict();

export type BaselineInput = z.infer<typeof baselineSchema>;

export const learningLogSchema = z
  .object({
    clarity: scale("clarity"),
    alignment: scale("alignment"),
    is_blocked: z.boolean().default(false),
    blocker_context: z
      .string()
      .max(2000, "blocker_context must be 2000 characters or fewer")
      .optional()
      .nullable(),
    accomplished: z
      .string()
      .max(2000, "accomplished must be 2000 characters or fewer")
      .optional()
      .nullable(),
    exploring: z
      .string()
      .max(2000, "exploring must be 2000 characters or fewer")
      .optional()
      .nullable(),
    next_focus: z
      .string()
      .max(2000, "next_focus must be 2000 characters or fewer")
      .optional()
      .nullable(),
    // Work-log fields (00069) — only meaningful for org-cycle logs (the member
    // tier of the Leadership Log cascade); the card shows them for mode='org'
    // only, and the route persists them only for org cycles.
    work_summary: z
      .string()
      .max(2000, "work_summary must be 2000 characters or fewer")
      .optional()
      .nullable(),
    work_progress: z
      .string()
      .max(2000, "work_progress must be 2000 characters or fewer")
      .optional()
      .nullable(),
    work_blockers: z
      .string()
      .max(2000, "work_blockers must be 2000 characters or fewer")
      .optional()
      .nullable(),
    share_publicly: z.boolean().default(false),
    cycle_id: z.number().int().positive().optional().nullable(),
    // Baseline onboarding reflection (one-time per cycle). When present, the
    // route files a kind='baseline' log + baseline_responses row and skips the
    // weekly milestone/work-field derivation entirely.
    baseline: baselineSchema.optional(),
  })
  .strict();

export type LearningLogInput = z.infer<typeof learningLogSchema>;

/** The share paragraph — the server-side twin of the card's live preview.
    Metrics never appear here; only the three prompts, concatenated. */
export function sharedParagraph(input: LearningLogInput): string {
  const parts: string[] = [];
  if (input.accomplished?.trim())
    parts.push(`This week, I figured out ${input.accomplished.trim()}`);
  if (input.exploring?.trim())
    parts.push(`I’m currently exploring ${input.exploring.trim()}`);
  if (input.next_focus?.trim())
    parts.push(`Next week, my focus is ${input.next_focus.trim()}`);
  return parts.join(" ");
}
