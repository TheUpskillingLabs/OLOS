import type { SupabaseClient } from "@supabase/supabase-js";

/* Learning-Log health for one pod (Phase 1's Poderator repoint — the
   prototype's health bands measure sentiment, not just compliance):
   clarity/alignment averages over each member's latest recent log,
   blocked members FIRST with their own words (the "what do you need"
   text), and the logged/waiting compliance split for the current window.
   Shepherd rules hold: signals to unblock with, never grades; staff/test
   and inactive members are outside the math. */

export interface BlockedMember {
  participant_id: number;
  display_name: string;
  email: string | null;
  blocker_context: string | null;
  logged_at: string;
}

export interface LogHealth {
  /** Members with at least one log in the lookback window. */
  sample_size: number;
  avg_clarity: number | null;
  avg_alignment: number | null;
  /** Latest log says blocked — surfaced first, in their own words. */
  blocked: BlockedMember[];
  /** Compliance for the current gate window (or trailing 7 days unarmed). */
  logged_ids: number[];
  waiting_ids: number[];
  window_due_at: string | null;
}

const LOOKBACK_DAYS = 14;

interface MemberInput {
  participant_id: number;
  display_name: string;
  email: string | null;
  is_inactive: boolean;
  is_staff_or_test: boolean;
}

export async function getLogHealth(
  supabase: SupabaseClient,
  cycleId: number,
  members: MemberInput[]
): Promise<LogHealth> {
  const real = members.filter((m) => !m.is_inactive && !m.is_staff_or_test);
  const ids = real.map((m) => m.participant_id);
  const empty: LogHealth = {
    sample_size: 0,
    avg_clarity: null,
    avg_alignment: null,
    blocked: [],
    logged_ids: [],
    waiting_ids: ids,
    window_due_at: null,
  };
  if (ids.length === 0) return { ...empty, waiting_ids: [] };

  const { data: config } = await supabase
    .from("cycle_config")
    .select("log_due_at, log_gate_paused")
    .eq("cycle_id", cycleId)
    .maybeSingle();
  const windowDueAt =
    config?.log_due_at && !config.log_gate_paused ? config.log_due_at : null;

  const lookback = new Date();
  lookback.setDate(lookback.getDate() - LOOKBACK_DAYS);

  const { data: logs } = await supabase
    .from("learning_logs")
    .select(
      "participant_id, clarity, alignment, is_blocked, blocker_context, created_at"
    )
    .in("participant_id", ids)
    .gte("created_at", lookback.toISOString())
    .order("created_at", { ascending: false });

  // Latest log per member drives sentiment + blocked state.
  const latest = new Map<
    number,
    { clarity: number; alignment: number; is_blocked: boolean; blocker_context: string | null; created_at: string }
  >();
  for (const log of logs ?? []) {
    if (!latest.has(log.participant_id)) latest.set(log.participant_id, log);
  }

  const sampled = [...latest.values()];
  const avg = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

  const blocked: BlockedMember[] = real
    .filter((m) => latest.get(m.participant_id)?.is_blocked)
    .map((m) => {
      const log = latest.get(m.participant_id)!;
      return {
        participant_id: m.participant_id,
        display_name: m.display_name,
        email: m.email,
        blocker_context: log.blocker_context,
        logged_at: log.created_at,
      };
    });

  // Compliance: the armed window if there is one, else trailing 7 days.
  const complianceFloor =
    windowDueAt ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const loggedSet = new Set(
    (logs ?? [])
      .filter((l) => l.created_at >= complianceFloor)
      .map((l) => l.participant_id)
  );

  return {
    sample_size: sampled.length,
    avg_clarity: avg(sampled.map((s) => s.clarity)),
    avg_alignment: avg(sampled.map((s) => s.alignment)),
    blocked,
    logged_ids: ids.filter((id) => loggedSet.has(id)),
    waiting_ids: ids.filter((id) => !loggedSet.has(id)),
    window_due_at: windowDueAt,
  };
}
