import { z } from "zod";

/**
 * Validations for the poderator-dashboard API routes (PRD
 * §7.7 switcher, §7.8 tooltips, §7.2 nudge dismissal).
 *
 * Schemas are intentionally permissive on the JSON-blob fields
 * (`roster_filters`) — the dashboard evolves filter knobs over time and
 * we don't want every new filter to require a migration. Concrete shape
 * is enforced at render time, not here.
 */

/** Switcher last-view: 'all_pods' or a pod id as a string. */
const lastViewSchema = z
  .string()
  .min(1)
  .max(32)
  .refine(
    (v) => v === "all_pods" || /^\d+$/.test(v),
    "last_view must be 'all_pods' or a numeric pod id"
  );

/** Tooltip-suppression keys (PRD §7.8). */
const tooltipSeenSchema = z
  .array(z.string().min(1).max(64))
  .max(64, "tooltip_seen has too many entries");

/**
 * PUT /api/moderator/ui-state — upsert per-poderator state.
 * All fields optional so callers can patch one knob at a time
 * (filter change shouldn't have to re-send tooltip_seen, etc.).
 */
export const uiStatePutSchema = z.object({
  last_view: lastViewSchema.optional(),
  roster_filters: z.record(z.string(), z.unknown()).optional(),
  roster_sort: z.string().min(1).max(64).optional(),
  tooltip_seen: tooltipSeenSchema.optional(),
});

export type UiStatePutInput = z.infer<typeof uiStatePutSchema>;

/**
 * POST /api/moderator/nudges/dismiss — record a per-poderator nudge
 * dismissal (PRD §7.2). Caller must be the dismissing poderator;
 * server-side check verifies pod assignment.
 */
export const nudgeDismissSchema = z.object({
  pod_id: z.number().int().positive({
    message: "pod_id must be a positive number",
  }),
  nudge_key: z
    .string()
    .min(1, "nudge_key is required")
    .max(128, "nudge_key must be 128 characters or fewer"),
});

export type NudgeDismissInput = z.infer<typeof nudgeDismissSchema>;
