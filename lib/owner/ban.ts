// Owner lifecycle — BAN / UNBAN.
//
// A ban is "archive, and also lock the door". Archive alone does not lock it:
// the OAuth callback only checks that a participants row exists, so an archived
// person still signs in with no roles. Delete does not lock it either — the
// /register funnel re-creates the row. See migration 00102's header.
//
// banParticipant therefore composes three things:
//   1. archiveParticipant() — the existing, tested deactivation.
//   2. a participant_bans row — keyed on email so it outlives the row, and read
//      by the sign-in and registration gates (lib/auth/bans.ts).
//   3. auth.users.banned_until — an independent layer inside GoTrue, which
//      refuses new sign-ins AND refresh-token exchanges.
//
// Like archive.ts this runs on the SERVICE client and is idempotent, so a retried
// request is a no-op and the returned counts reflect only what this call changed.
// The caller (app/api/owner/[entity]/[id]/route.ts) runs the apex-owner and self
// guards first; these helpers do not re-check them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveParticipant, type ArchiveParticipantResult } from "./archive";

/** ~100 years. GoTrue takes a Go duration string; there is no "forever". */
const BAN_DURATION = "876000h";

export interface BanParticipantResult extends ArchiveParticipantResult {
  /** Did THIS call create the blocklist row (vs. already banned)? */
  banned: boolean;
  /** Did we manage to set banned_until on auth.users? */
  authLocked: boolean;
  /** Set when the person never signed in, so there is no auth.users row. */
  note?: string;
}

export interface UnbanParticipantResult {
  /** Did THIS call lift a blocklist row? */
  unbanned: boolean;
  /** Did THIS call clear archived_at? */
  reactivated: boolean;
  authUnlocked: boolean;
}

interface Target {
  id: number;
  email: string | null;
  google_id: string | null;
  auth_user_id: string | null;
}

async function loadTarget(
  client: SupabaseClient,
  participantId: number
): Promise<Target | null> {
  const { data } = await client
    .from("participants")
    .select("id, email, google_id, auth_user_id")
    .eq("id", participantId)
    .maybeSingle();
  return (data as Target | null) ?? null;
}

/**
 * Ban a participant: revoke everything, blocklist the email, lock the auth row.
 *
 * Reversible via unbanParticipant, though — exactly like archive — an unban does
 * NOT restore roles. Re-grant those through the access console.
 *
 * IMPORTANT: this deliberately does NOT delete the participants row. Keeping it
 * means the funnel's dedup check bounces them too, and the ban keeps a face and a
 * history in the console. Deleting is what would let them back in.
 */
export async function banParticipant(
  client: SupabaseClient,
  participantId: number,
  opts: { reason?: string | null; actorParticipantId?: number | null } = {}
): Promise<BanParticipantResult> {
  const target = await loadTarget(client, participantId);
  if (!target) throw new Error(`banParticipant: no participant ${participantId}`);
  if (!target.email) throw new Error(`banParticipant: participant ${participantId} has no email`);

  // 1. Everything archive does.
  const archived = await archiveParticipant(client, participantId);

  // 2. The blocklist row. The partial unique index on lower(email) WHERE
  //    revoked_at IS NULL means a second active ban raises 23505 — that is the
  //    idempotent path, not an error.
  let banned = false;
  const { error: insertError } = await client.from("participant_bans").insert({
    email: target.email,
    google_id: target.google_id,
    participant_id: target.id,
    reason: opts.reason ?? null,
    banned_by: opts.actorParticipantId ?? null,
  });
  if (!insertError) {
    banned = true;
  } else if (insertError.code !== "23505") {
    throw insertError;
  }

  // 3. The GoTrue layer. Independent of anything above, so a missed app gate
  //    still fails closed.
  let authLocked = false;
  let note: string | undefined;
  if (target.auth_user_id) {
    const { error } = await client.auth.admin.updateUserById(target.auth_user_id, {
      ban_duration: BAN_DURATION,
    });
    if (error) throw error;
    authLocked = true;
  } else {
    note = "This person never signed in, so there is no auth record to lock. The blocklist still applies.";
  }

  return { ...archived, banned, authLocked, note };
}

/**
 * Lift a ban: revoke the blocklist row, clear archived_at, unlock the auth row.
 *
 * Roles, enrollments and memberships are NOT restored — the same contract as
 * un-archiving. The ban history is kept (revoked_at is stamped rather than the
 * row deleted), so a re-ban inserts a fresh row and the audit trail stays whole.
 */
export async function unbanParticipant(
  client: SupabaseClient,
  participantId: number,
  opts: { actorParticipantId?: number | null } = {}
): Promise<UnbanParticipantResult> {
  const target = await loadTarget(client, participantId);
  if (!target) throw new Error(`unbanParticipant: no participant ${participantId}`);
  if (!target.email) throw new Error(`unbanParticipant: participant ${participantId} has no email`);

  const { data: lifted } = await client
    .from("participant_bans")
    .update({ revoked_at: new Date().toISOString(), revoked_by: opts.actorParticipantId ?? null })
    .ilike("email", target.email.replace(/[\\%_]/g, "\\$&"))
    .is("revoked_at", null)
    .select("id");

  const { data: reactivated } = await client
    .from("participants")
    .update({ archived_at: null })
    .eq("id", participantId)
    .not("archived_at", "is", null)
    .select("id");

  let authUnlocked = false;
  if (target.auth_user_id) {
    const { error } = await client.auth.admin.updateUserById(target.auth_user_id, {
      ban_duration: "none",
    });
    if (error) throw error;
    authUnlocked = true;
  }

  return {
    unbanned: (lifted?.length ?? 0) > 0,
    reactivated: (reactivated?.length ?? 0) > 0,
    authUnlocked,
  };
}
