import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupUserByEmail, getChannelAuthorIds } from "./slack";

/* Polled Slack membership + intro-post verification (issue #189), shared by the
   daily cron and the admin manual-trigger — the same pattern as syncLumaEvents.

   Two cheap passes over the active cohort:
   1. Resolve each member's Slack user id from their (unique) email via
      users.lookupByEmail and cache it in participants.slack_user_id. A
      resolvable account means they're in the workspace → stamp slack_joined_at.
   2. Read the #intros channel history ONCE into a set of author ids, then stamp
      slack_intro_at for every member whose id is in it. (Fetch once, reconcile
      many — like Luma's guest-list mirror.)

   Best-effort throughout: a per-member lookup failure is collected in errors[]
   and the run continues. Both stamps are write-once (never re-stamped) so the
   surfaces show "first verified at". */

export interface SlackVerifySummary {
  checked: number;
  resolved: number; // slack_user_id newly resolved this run
  joined: number; // slack_joined_at newly stamped this run
  intros: number; // slack_intro_at newly stamped this run
  errors: string[];
}

interface ParticipantRow {
  id: number;
  email: string | null;
  slack_user_id: string | null;
  slack_joined_at: string | null;
  slack_intro_at: string | null;
}

export async function verifySlackMembership(
  supabase: SupabaseClient
): Promise<SlackVerifySummary> {
  const summary: SlackVerifySummary = {
    checked: 0,
    resolved: 0,
    joined: 0,
    intros: 0,
    errors: [],
  };

  // Onboarding verification only concerns the active cohort.
  const { data: activeCycle } = await supabase
    .from("cycles")
    .select("id")
    .eq("status", "active")
    .maybeSingle();
  if (!activeCycle) return summary;

  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select(
      "participant_id, participants:participant_id(id, email, slack_user_id, slack_joined_at, slack_intro_at)"
    )
    .eq("cycle_id", activeCycle.id)
    .eq("status", "active");

  // Flatten + dedupe (a participant could appear once per enrollment row).
  const participants = new Map<number, ParticipantRow>();
  for (const e of enrollments ?? []) {
    const p = (
      Array.isArray(e.participants) ? e.participants[0] : e.participants
    ) as ParticipantRow | null;
    if (p?.id) participants.set(p.id, p);
  }

  const nowIso = new Date().toISOString();

  // Pass 1: resolve id + workspace membership.
  for (const p of participants.values()) {
    summary.checked++;

    if (!p.slack_user_id && p.email) {
      try {
        const uid = await lookupUserByEmail(p.email);
        if (uid) {
          p.slack_user_id = uid;
          summary.resolved++;
        }
      } catch (e) {
        summary.errors.push(
          `lookup ${p.email}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    const patch: Record<string, unknown> = { slack_checked_at: nowIso };
    if (p.slack_user_id) {
      patch.slack_user_id = p.slack_user_id;
      if (!p.slack_joined_at) {
        patch.slack_joined_at = nowIso;
        summary.joined++;
      }
    }
    const { error } = await supabase
      .from("participants")
      .update(patch)
      .eq("id", p.id);
    if (error) summary.errors.push(`update ${p.id}: ${error.message}`);
  }

  // Pass 2: intro-post detection.
  const channelId = process.env.SLACK_INTRO_CHANNEL_ID;
  if (!channelId) {
    summary.errors.push(
      "SLACK_INTRO_CHANNEL_ID not set — skipped intro-post detection"
    );
    return summary;
  }

  let authors: Set<string>;
  try {
    authors = await getChannelAuthorIds(channelId);
  } catch (e) {
    // A common cause is the bot not being a member of #intros — surface it
    // clearly rather than silently finding no intros.
    summary.errors.push(
      `intro channel read (is the bot in #intros?): ${e instanceof Error ? e.message : String(e)}`
    );
    return summary;
  }

  for (const p of participants.values()) {
    if (p.slack_user_id && !p.slack_intro_at && authors.has(p.slack_user_id)) {
      const { error } = await supabase
        .from("participants")
        .update({ slack_intro_at: nowIso })
        .eq("id", p.id);
      if (error) summary.errors.push(`intro ${p.id}: ${error.message}`);
      else summary.intros++;
    }
  }

  return summary;
}
