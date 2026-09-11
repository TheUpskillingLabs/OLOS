// Ban lookups for the sign-in and registration gates.
//
// The blocklist (participant_bans, migration 00102) is keyed on lower(email) so
// it outlives the participants row — deleting a banned person must not hand them
// a way back in through /register. Read the migration header for why the ban is
// email-keyed rather than participant-keyed.
//
// Callers pass the SERVICE client: both gates run before (or without) a resolved
// app identity, and participant_bans has an owner-only read policy.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ActiveBan {
  id: number;
  email: string;
  reason: string | null;
  bannedAt: string;
}

/**
 * The active ban for an email, or null. Case-insensitive: the unique index is on
 * lower(email), and `ilike` with the pattern characters escaped matches the same
 * rows without ILIKE reading `_`/`%` from the address as wildcards (same hazard
 * lib/auth/email.ts exists for).
 *
 * Fails OPEN on a query error and returns null. A ban is a door lock, not a
 * liveness dependency: a transient database blip must not lock every member out
 * of sign-in. The second layer (auth.users.banned_until, set by lib/owner/ban.ts)
 * is inside GoTrue and keeps holding regardless of what this returns.
 */
export async function getActiveBan(
  client: SupabaseClient,
  email: string
): Promise<ActiveBan | null> {
  if (!email) return null;
  const { data, error } = await client
    .from("participant_bans")
    .select("id, email, reason, banned_at")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as number,
    email: data.email as string,
    reason: (data.reason as string | null) ?? null,
    bannedAt: data.banned_at as string,
  };
}

/** Convenience predicate over getActiveBan. */
export async function isEmailBanned(
  client: SupabaseClient,
  email: string
): Promise<boolean> {
  return (await getActiveBan(client, email)) !== null;
}
