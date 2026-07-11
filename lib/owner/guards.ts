// Owner lifecycle guardrails (API layer).
//
// These mirror the last-line-of-defense checks the SECURITY DEFINER RPCs enforce
// in the DB, so the UI gets a clear 4xx instead of a raw RAISE. The RPCs remain
// authoritative — never rely on these alone.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GuardKey } from "./types";

/** Pure: is the target the acting owner themselves? */
export function isSelf(actorParticipantId: number | null, targetId: number): boolean {
  return actorParticipantId != null && actorParticipantId === targetId;
}

/**
 * Is this participant the rooted (apex) owner — an active `owner` grant with
 * `granted_by IS NULL` (the primary owner, migration 00066)? The apex owner is
 * never console-deletable/archivable/resettable.
 */
export async function isApexOwner(
  client: SupabaseClient,
  participantId: number
): Promise<boolean> {
  const { data } = await client
    .from("participant_roles")
    .select("participant_id")
    .eq("participant_id", participantId)
    .eq("role", "owner")
    .is("granted_by", null)
    .is("revoked_at", null)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export interface GuardContext {
  actorParticipantId: number | null;
  targetId: number;
}

export type GuardResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Evaluate a descriptor's guards. Returns the first failure (409) or { ok: true }.
 * An empty guard list (cycles/pods/projects) is a no-op. `apexOwner`/`self` are the
 * participant hard-blocks; `activeCycle`/`defaultMetro` are Phase 3 entity guards not
 * yet wired — an unrecognized guard fails closed rather than being silently skipped.
 */
export async function checkOwnerGuards(
  client: SupabaseClient,
  guards: GuardKey[],
  ctx: GuardContext
): Promise<GuardResult> {
  for (const guard of guards) {
    switch (guard) {
      case "self":
        if (isSelf(ctx.actorParticipantId, ctx.targetId)) {
          return { ok: false, status: 409, error: "You cannot perform this action on your own profile." };
        }
        break;
      case "apexOwner":
        if (await isApexOwner(client, ctx.targetId)) {
          return { ok: false, status: 409, error: "The primary owner cannot be modified from this console." };
        }
        break;
      default:
        return { ok: false, status: 500, error: `Unsupported guard: ${guard}` };
    }
  }
  return { ok: true };
}
