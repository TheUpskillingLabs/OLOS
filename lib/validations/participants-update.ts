import { z } from "zod";

// Reject the literal placeholder value 'Unknown' (case-insensitive, trimmed)
// that scripts/migration/migrate.py wrote for participants missing name data.
// The architecture review at docs/architecture-review-onboarding-state-machine.md
// (broken edges #3 and #4) flags this as the value Mode B is designed to eliminate.
const PLACEHOLDER_NAME = /^unknown$/i;

const nameField = z
  .string()
  .min(1, "cannot be empty")
  .max(100)
  .refine((s) => !PLACEHOLDER_NAME.test(s.trim()), {
    message: "cannot be 'Unknown'",
  });

/**
 * Partial-update schema for PATCH /api/participants/[participant_id].
 *
 * - `.partial()` makes every top-level field optional (PATCH semantic: send
 *   only the fields you're changing).
 * - `.strict()` rejects unknown keys, preventing a client from PATCHing
 *   sensitive fields not in this whitelist (email, auth_user_id, google_id,
 *   id, created_at, etc.). RLS migration 00021 is the second line of defense.
 * - Name fields reject the placeholder string so Mode B's purpose is preserved.
 *
 * Whitelist of editable fields (intentionally narrow for Phase B):
 *   - first_name, last_name, preferred_name
 *
 * Profile-expansion fields (neighborhood, work_situation, linkedin, etc.) can
 * be added to this schema in a follow-up without changing the route logic.
 */
export const participantsUpdateSchema = z
  .object({
    first_name: nameField,
    last_name: nameField,
    preferred_name: z.string().min(1).max(100).nullable(),
  })
  .partial()
  .strict();

export type ParticipantsUpdate = z.infer<typeof participantsUpdateSchema>;
