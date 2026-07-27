/* Task instance keys — the dismissal/recurrence unit of the central task
   system (mirrors atRiskNudgeKey in lib/moderator/nudges.ts).

   The key names a specific OCCURRENCE of a task, not the task in general:
   a task_dismissals row persists until the task recurs under a new key.
   Recurring tasks therefore come back by construction — the window task
   rotates on cycle id, the "what's next" nudge on (cycle, week), the weekly
   log on each Friday stamp — with no timers and no cleanup job. This is
   also the fix for the old localStorage store, whose bare ids ("voting")
   made one dismissal hide a recurring task in every future cycle.

   Pure module: no Supabase, importable from client components. */

import type { WindowKey } from "@/lib/cycles/windows";

/** Server-side validation bound for task_dismissals.task_key (same bound as
    nudge_keys). Segments are colon-separated; the first names the task kind. */
export const TASK_KEY_MAX_LENGTH = 200;
export const TASK_KEY_PATTERN = /^[a-z_]+(:[A-Za-z0-9_.:-]+)*$/;

export function isValidTaskKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= TASK_KEY_MAX_LENGTH &&
    TASK_KEY_PATTERN.test(key)
  );
}

/* ── Builders ─────────────────────────────────────────────────────────────
   One per task kind; the suffix encodes exactly the scope the task recurs
   on. Never dismissible kinds still get keys (identity + symmetry), but the
   assembler ignores dismissals recorded against them. */

/** A cycle-action window task — recurs per cycle. */
export function windowTaskKey(windowKey: WindowKey, cycleId: number): string {
  return `window:${windowKey}:c${cycleId}`;
}

/** The blocking weekly Learning Log — recurs per Friday stamp. Never
    dismissible; the key exists for identity only. The stamp is normalized
    ("2026-07-03 00:00:00" → "…T00:00:00") so a raw naive column value and
    its ISO form yield the same key. */
export function weeklyLogTaskKey(cycleId: number, logDueAt: string): string {
  return `weekly_log:c${cycleId}:${logDueAt.trim().replace(" ", "T")}`;
}

/** One-time account-scoped setup rows (profile, follow, slack, first_log). */
export function setupTaskKey(
  step: "profile" | "follow" | "slack" | "first_log"
): string {
  return `setup:${step}`;
}

/** Per-cycle setup rows (register, pod, baseline). */
export function cycleSetupTaskKey(
  step: "register" | "pod" | "baseline",
  cycleId: number
): string {
  return `setup:${step}:c${cycleId}`;
}

/** The field-survey "start here" CTA — per survey. Not dismissible. */
export function surveyContributeTaskKey(surveyId: number): string {
  return `survey_contribute:s${surveyId}`;
}

/** The "share the survey" nudge — per survey. Dismissible. */
export function surveyShareTaskKey(surveyId: number): string {
  return `survey_share:s${surveyId}`;
}

/** The per-week admin "what's next" nudge — same semantics as the old
    localStorage "{cycleId}:{week}" token, so dismissal auto-expires at the
    week rollover. */
export function whatsNextTaskKey(cycleId: number, week: number): string {
  return `whats_next:c${cycleId}:w${week}`;
}

/** A leadership-log scope's weekly duty — per (tier, cycle, pod|lab). Not
    dismissible (submitting resolves it). */
export function leadershipLogTaskKey(
  tier: string,
  cycleId: number,
  podId: number | null,
  labId: number | null
): string {
  const scope = podId != null ? `p${podId}` : labId != null ? `l${labId}` : "x";
  return `leadership_log:${tier}:c${cycleId}:${scope}`;
}
