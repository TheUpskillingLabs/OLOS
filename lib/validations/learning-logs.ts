import { z } from "zod";

/* The Learning Log write shape (backend doc §6; migration 00040).
   Three parts: health check (clarity/alignment 1–5 + blocked), scaffolded
   reflection (three prompts), share toggle. cycle_id and kind are derived
   server-side — never trusted from the client. Strict + versioned per
   DATA_ARCHITECTURE §2 principle 3. */

const scale = (field: string) =>
  z
    .number({ message: `${field} is required` })
    .int(`${field} must be an integer between 1 and 5`)
    .min(1, `${field} must be an integer between 1 and 5`)
    .max(5, `${field} must be an integer between 1 and 5`);

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
    share_publicly: z.boolean().default(false),
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
