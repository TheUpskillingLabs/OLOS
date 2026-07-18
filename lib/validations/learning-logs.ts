import { z } from "zod";
import { HOURS_BUCKETS } from "@/lib/cycles/hours";

/* The Learning Log write shape (backend doc §6; migrations 00040 + 00091).
   Two instruments share one strict superset schema, because kind — which
   decides the instrument — is derived server-side AFTER parse (it needs
   body.cycle_id), so a zod discriminated union can't carry it:

   - weekly v2 (kind='weekly' on an open cycle; 00091): stuck check
     (is_blocked + stuck_tried + blocker_context-as-help), hours_bucket,
     collab/progress/capability/energy ratings, contribution, learned,
     optional feeling_word + recognition.
   - legacy v1 (milestone reviews, journal logs, org-cycle logs): clarity /
     alignment health check + three prompts (+ org work fields, 00069).

   The superset makes every instrument-specific field optional; the route
   applies weeklyV2Error / legacyError after resolving kind. Strict +
   versioned per DATA_ARCHITECTURE §2 principle 3.

   cycle_id is an OPTIONAL client hint (migration 00060 / org cycles: a
   member can hold an active enrollment in more than one active cycle at
   once, so the server can no longer always infer a single one). When
   present it's validated server-side against the member's own active
   enrollments in active cycles (app/api/learning-logs/route.ts) — never
   trusted as-is. */

const scale = (field: string) =>
  z
    .number({ message: `${field} is required` })
    .int(`${field} must be an integer between 1 and 5`)
    .min(1, `${field} must be an integer between 1 and 5`)
    .max(5, `${field} must be an integer between 1 and 5`);

const text = (field: string, max = 2000) =>
  z
    .string()
    .max(max, `${field} must be ${max} characters or fewer`)
    .optional()
    .nullable();

export const learningLogSchema = z
  .object({
    // Legacy health check — required for v1 saves (legacyError), absent on
    // weekly v2 (00091 dropped NOT NULL).
    clarity: scale("clarity").optional().nullable(),
    alignment: scale("alignment").optional().nullable(),
    // Shared: v1 "I'm blocked" IS v2's "Are you stuck?" — same column, same
    // Poderator blocked-first rollup. blocker_context is v1's "What do you
    // need?" and v2's "What kind of help would move this forward?".
    is_blocked: z.boolean().default(false),
    blocker_context: text("blocker_context"),
    // Legacy reflection prompts (v1 only).
    accomplished: text("accomplished"),
    exploring: text("exploring"),
    next_focus: text("next_focus"),
    // Work-log fields (00069) — only meaningful for org-cycle logs (the member
    // tier of the Leadership Log cascade); the card shows them for mode='org'
    // only, and the route persists them only for org cycles.
    work_summary: text("work_summary"),
    work_progress: text("work_progress"),
    work_blockers: text("work_blockers"),
    // Weekly v2 instrument (00091).
    stuck_tried: text("stuck_tried"),
    hours_bucket: z
      .enum(HOURS_BUCKETS, {
        message: "hours_bucket must be one of the weekly hours buckets",
      })
      .optional()
      .nullable(),
    collab_rating: scale("collab_rating").optional().nullable(),
    progress_rating: scale("progress_rating").optional().nullable(),
    contribution: text("contribution"),
    learned: text("learned"),
    capability_rating: scale("capability_rating").optional().nullable(),
    energy_rating: scale("energy_rating").optional().nullable(),
    feeling_word: z
      .string()
      .trim()
      .max(50, "feeling_word must be 50 characters or fewer")
      .regex(/^\S*$/, "feeling_word must be a single word")
      .optional()
      .nullable(),
    recognition: text("recognition", 300),
    share_publicly: z.boolean().default(false),
    cycle_id: z.number().int().positive().optional().nullable(),
  })
  .strict();

export type LearningLogInput = z.infer<typeof learningLogSchema>;

const filled = (s: string | null | undefined) => !!s?.trim();

/** Weekly v2 requiredness — items 1–7 required, 8/9 optional; the stuck
    follow-ups (1b/1c) are required only when stuck. Returns the first
    human-readable problem, or null when the payload is a valid v2 save. */
export function weeklyV2Error(input: LearningLogInput): string | null {
  if (input.is_blocked && !filled(input.stuck_tried))
    return "Tell us what you've already tried and where it broke down";
  if (input.is_blocked && !filled(input.blocker_context))
    return "Tell us what kind of help would move this forward";
  if (!input.hours_bucket)
    return "Pick the hours you put into Labs work this week";
  if (input.collab_rating == null)
    return "Rate your collaboration this week";
  if (input.progress_rating == null) return "Rate your progress this week";
  if (!filled(input.contribution))
    return "Share what you created or contributed this week";
  if (!filled(input.learned))
    return "Share one thing you learned or figured out this week";
  if (input.capability_rating == null)
    return "Rate how capable you feel compared to last week";
  if (input.energy_rating == null)
    return "Rate your energy heading into next week";
  return null;
}

/** Legacy (v1) requiredness — the superset schema made clarity/alignment
    optional, so v1 saves (milestone / journal / org) re-assert them here. */
export function legacyError(input: LearningLogInput): string | null {
  if (input.clarity == null || input.alignment == null)
    return "clarity and alignment are required";
  return null;
}

/** True when the payload carries weekly-v2 answers — used to tell a stale
    v2 form apart from a genuinely malformed v1 save when the server derives
    a milestone kind (week rolled over under an open form). */
export function looksLikeWeeklyV2(input: LearningLogInput): boolean {
  return (
    input.hours_bucket != null ||
    input.collab_rating != null ||
    input.progress_rating != null ||
    input.capability_rating != null ||
    input.energy_rating != null ||
    filled(input.contribution) ||
    filled(input.learned)
  );
}

/** The share paragraph — the server-side twin of the card's live preview.
    Metrics never appear here. v1 concatenates the three prompts; weekly v2
    composes from contribution (4b) + learned (5) only. */
export function sharedParagraph(
  input: LearningLogInput,
  instrument: "v1" | "weekly_v2" = "v1"
): string {
  const parts: string[] = [];
  if (instrument === "weekly_v2") {
    if (input.contribution?.trim())
      parts.push(`This week: ${input.contribution.trim()}`);
    if (input.learned?.trim())
      parts.push(`One thing I figured out: ${input.learned.trim()}`);
    return parts.join(" ");
  }
  if (input.accomplished?.trim())
    parts.push(`This week, I figured out ${input.accomplished.trim()}`);
  if (input.exploring?.trim())
    parts.push(`I’m currently exploring ${input.exploring.trim()}`);
  if (input.next_focus?.trim())
    parts.push(`Next week, my focus is ${input.next_focus.trim()}`);
  return parts.join(" ");
}
