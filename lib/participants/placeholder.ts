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
 * layout's redirect, the /profile/edit page header copy, and the
 * submission-endpoint guards all match the same predicate. Mirrors the
 * .refine() in lib/validations/participants-update.ts.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

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

/**
 * Server-side guard for participant-submission endpoints. Defense-in-depth
 * partner to the dashboard-layout redirect in app/(dashboard)/layout.tsx —
 * the layout protects browser navigation; this protects direct API calls
 * (curl, scripts, anything that skips the layout).
 *
 * Returns a 403 NextResponse with a redirect hint when the participant has
 * a placeholder name; returns null when the profile is complete and the
 * caller should proceed. Pattern matches parseBody + isErrorResponse.
 *
 * Caller idiom:
 *   const guard = await requireCompleteProfile(auth.supabase, participantId);
 *   if (guard) return guard;
 *
 * The 'redirect_hint' field tells the client where to send the user to fix
 * the problem. Used by participant-facing UI components that wrap fetch
 * calls; ignored by raw consumers (curl).
 */
export async function requireCompleteProfile(
  supabase: SupabaseClient,
  participantId: number
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from("participants")
    .select("first_name, last_name")
    .eq("id", participantId)
    .maybeSingle();

  if (data && hasPlaceholderName(data.first_name, data.last_name)) {
    return NextResponse.json(
      {
        error: "profile_incomplete",
        redirect_hint: "/profile/edit?required=true",
      },
      { status: 403 }
    );
  }
  return null;
}
