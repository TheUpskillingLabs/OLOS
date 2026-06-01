/**
 * Case-insensitive participant.email lookups must use ILIKE because the
 * underlying column stores mixed-case values. Bare ILIKE interprets `_` and
 * `%` from the input as wildcards, and `_` is a valid character in email
 * local-parts — a naïve lookup for `user_name@x.com` could also match
 * `userXname@x.com`. Escape both characters first to neutralize the
 * pattern semantics.
 *
 * Auth callback (app/api/auth/callback/route.ts) and short-form registration
 * (app/api/registrations/short/route.ts) both look up participants by email
 * and use this helper. The case-insensitive unique index from migration
 * 00016 on lower(email) still benefits the underlying query.
 */
export function escapeEmailForIlike(email: string): string {
  return email.replace(/[\\%_]/g, "\\$&");
}
