/**
 * Placeholder-name detection helpers.
 *
 * The migration script at scripts/migration/migrate.py:711-716 (Pass 1 —
 * missing names) and :884-885 (Pass 1.5 — orphan-email stubs) writes
 * first_name='Unknown' / last_name='Unknown' when source data lacks names.
 * Three prod participants currently carry these values; the consolidated
 * onboarding work (#110) ensures they self-fix or get fixed by an admin
 * before they can engage with cycle activity.
 *
 * Centralized here so the auth callback's invitation guard, the dashboard
 * layout's redirect, the /profile/edit page header copy, and any future
 * submission-endpoint guards all match the same predicate. Mirrors the
 * .refine() in lib/validations/participants-update.ts.
 */

const PLACEHOLDER_PATTERN = /^unknown$/i;

/** True if the value is the literal 'Unknown' placeholder (case-insensitive, trimmed). */
export function isPlaceholderValue(value: string | null | undefined): boolean {
  return PLACEHOLDER_PATTERN.test((value ?? "").trim());
}

/** True if either name field is the placeholder. */
export function hasPlaceholderName(
  first: string | null | undefined,
  last: string | null | undefined
): boolean {
  return isPlaceholderValue(first) || isPlaceholderValue(last);
}
