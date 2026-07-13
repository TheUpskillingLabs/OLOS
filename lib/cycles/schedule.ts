/* Cycle schedule service — Stage 1 of the calendar overhaul
 * (docs/requirements/cycle-timeline.md + implementation-plan.md).
 *
 * cycle_phases / cycle_events (00085) are the tz-aware read model:
 * the window resolver (lib/auth/windows.ts) and the D-10 cycle-registration
 * gate read phase rows. For Stage 1 the WRITE model stays cycle_config —
 * the admin schedule PATCH keeps writing the legacy naive columns (one
 * write path, zero divergence risk mid-cycle) and calls
 * syncPhasesFromConfig() so the phase rows always mirror them. Stage 2
 * flips write authority to cycle_phases and retires the columns once the
 * page sweep is done.
 *
 * pod_active_join is DERIVED, not entered: Meet-the-Pods marker
 * (cycle_config.phase_2_start) → project_registration_close
 * (cycle-timeline.md window table; pod-registration.md two-window split).
 * Editing those two existing form fields moves the active-join window —
 * no new admin UI, and the O-1 "re-enter pod_registration on Aug 11"
 * fallback becomes unnecessary.
 *
 * All *_open/_close/phase_2_start values here follow the S5.1 storage
 * convention: naive wall-clock that IS the instant in UTC
 * (lib/cycles/lab-time.ts).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { parseWindow } from "@/lib/cycles/lab-time";

export type PhaseKey =
  | "problem_statement"
  | "voting"
  | "pod_forming"
  | "pod_active_join"
  | "solution_proposal"
  | "solution_voting"
  | "project_registration";

export interface PhaseRowInput {
  phase_key: PhaseKey;
  kind: "spine" | "overlay";
  position: number | null;
  starts_at: string; // ISO instant
  ends_at: string; // ISO instant
}

/** The naive cycle_config columns the schedule derives from. */
export interface ScheduleConfig {
  problem_statement_open?: string | null;
  problem_statement_close?: string | null;
  voting_open?: string | null;
  voting_close?: string | null;
  pod_registration_open?: string | null;
  pod_registration_close?: string | null;
  solution_proposal_open?: string | null;
  solution_proposal_close?: string | null;
  solution_voting_open?: string | null;
  solution_voting_close?: string | null;
  project_registration_open?: string | null;
  project_registration_close?: string | null;
  phase_2_start?: string | null;
  phase_3_start?: string | null;
}

const SPINE: { key: PhaseKey; position: number; open: keyof ScheduleConfig; close: keyof ScheduleConfig }[] = [
  { key: "problem_statement", position: 1, open: "problem_statement_open", close: "problem_statement_close" },
  { key: "voting", position: 2, open: "voting_open", close: "voting_close" },
  { key: "pod_forming", position: 3, open: "pod_registration_open", close: "pod_registration_close" },
  { key: "solution_proposal", position: 4, open: "solution_proposal_open", close: "solution_proposal_close" },
  { key: "solution_voting", position: 5, open: "solution_voting_open", close: "solution_voting_close" },
  { key: "project_registration", position: 6, open: "project_registration_open", close: "project_registration_close" },
];

/**
 * Pure: derive the full phase-row set from a cycle_config shape. Pairs with
 * a missing/invalid bound produce no row (matching the 00085 seed). The
 * pod_active_join overlay derives from phase_2_start →
 * project_registration_close.
 */
export function phaseRowsFromConfig(config: ScheduleConfig): PhaseRowInput[] {
  const rows: PhaseRowInput[] = [];
  for (const s of SPINE) {
    const open = parseWindow(config[s.open] ?? null);
    const close = parseWindow(config[s.close] ?? null);
    if (!open || !close || open >= close) continue;
    rows.push({
      phase_key: s.key,
      kind: "spine",
      position: s.position,
      starts_at: open.toISOString(),
      ends_at: close.toISOString(),
    });
  }
  const ajStart = parseWindow(config.phase_2_start ?? null);
  const ajEnd = parseWindow(config.project_registration_close ?? null);
  if (ajStart && ajEnd && ajStart < ajEnd) {
    rows.push({
      phase_key: "pod_active_join",
      kind: "overlay",
      position: null,
      starts_at: ajStart.toISOString(),
      ends_at: ajEnd.toISOString(),
    });
  }
  return rows;
}

/**
 * Re-derive and upsert a cycle's phase rows from its cycle_config row, and
 * delete phase rows whose source pair was cleared. Called by the admin
 * schedule PATCH after it writes cycle_config; also safe to call anywhere
 * the config changes. Service client — phase writes are system writes.
 */
export async function syncPhasesFromConfig(cycleId: number): Promise<void> {
  const client = createServiceClient();
  const { data: config, error } = await client
    .from("cycle_config")
    .select(
      "problem_statement_open, problem_statement_close, voting_open, voting_close, pod_registration_open, pod_registration_close, solution_proposal_open, solution_proposal_close, solution_voting_open, solution_voting_close, project_registration_open, project_registration_close, phase_2_start, phase_3_start"
    )
    .eq("cycle_id", cycleId)
    .maybeSingle();
  if (error) throw new Error(`syncPhasesFromConfig read: ${error.message}`);
  if (!config) return;

  const rows = phaseRowsFromConfig(config);
  if (rows.length > 0) {
    const { error: upsertErr } = await client
      .from("cycle_phases")
      .upsert(
        rows.map((r) => ({ cycle_id: cycleId, ...r })),
        { onConflict: "cycle_id,phase_key" }
      );
    if (upsertErr) throw new Error(`syncPhasesFromConfig upsert: ${upsertErr.message}`);
  }

  // Clear rows whose source pair no longer yields a window.
  const present = rows.map((r) => r.phase_key);
  const { error: delErr } = await client
    .from("cycle_phases")
    .delete()
    .eq("cycle_id", cycleId)
    .not(
      "phase_key",
      "in",
      `(${present.length ? present.map((k) => `"${k}"`).join(",") : '""'})`
    );
  if (delErr) throw new Error(`syncPhasesFromConfig prune: ${delErr.message}`);
}

/* ── D-10: the derived cycle-registration window ─────────────────────────
 * (docs/requirements/pod-registration.md D-10 / FR-8, owner 2026-07-12)
 *
 * Self-serve cycle registration is open exactly when a new member can
 * still land in a pod: through pod_forming close, again during
 * pod_active_join, closed otherwise. Invite fulfillment bypasses this
 * (it never calls the gated route).
 */

export type RegistrationState =
  | "open" // through pod_forming close (or no bounds configured yet)
  | "dead_zone" // between forming close and active-join open
  | "active_join" // second window
  | "closed"; // after active-join close (or forming closed, no active-join)

export interface RegistrationWindow {
  open: boolean;
  state: RegistrationState;
  /** When state === 'dead_zone': the instant registration reopens. */
  reopensAt: Date | null;
}

/** Pure D-10 derivation — bounds in ms (null = not configured). */
export function deriveRegistrationWindow(
  bounds: {
    formingEndMs: number | null;
    activeJoinStartMs: number | null;
    activeJoinEndMs: number | null;
  },
  nowMs: number
): RegistrationWindow {
  const { formingEndMs, activeJoinStartMs, activeJoinEndMs } = bounds;

  // No forming bound configured → the schedule isn't set; keep the legacy
  // status-gated behavior (open whenever the cycle admits registration).
  if (formingEndMs === null) {
    return { open: true, state: "open", reopensAt: null };
  }
  if (nowMs <= formingEndMs) {
    return { open: true, state: "open", reopensAt: null };
  }
  if (activeJoinStartMs !== null && activeJoinEndMs !== null) {
    if (nowMs < activeJoinStartMs) {
      return {
        open: false,
        state: "dead_zone",
        reopensAt: new Date(activeJoinStartMs),
      };
    }
    if (nowMs <= activeJoinEndMs) {
      return { open: true, state: "active_join", reopensAt: null };
    }
  }
  return { open: false, state: "closed", reopensAt: null };
}

/**
 * Resolve the registration window for a cycle: cycle_phases first
 * (pod_forming / pod_active_join), falling back to the legacy columns +
 * the same phase_2_start → project_registration_close derivation for
 * cycles without phase rows.
 */
export async function registrationWindow(
  client: SupabaseClient,
  cycleId: number,
  now: Date = new Date()
): Promise<RegistrationWindow> {
  const { data: phases } = await client
    .from("cycle_phases")
    .select("phase_key, starts_at, ends_at")
    .eq("cycle_id", cycleId)
    .in("phase_key", ["pod_forming", "pod_active_join"]);

  let formingEndMs: number | null = null;
  let ajStartMs: number | null = null;
  let ajEndMs: number | null = null;

  if (phases && phases.length > 0) {
    for (const p of phases) {
      if (p.phase_key === "pod_forming") {
        formingEndMs = parseWindow(p.ends_at)?.getTime() ?? null;
      } else if (p.phase_key === "pod_active_join") {
        ajStartMs = parseWindow(p.starts_at)?.getTime() ?? null;
        ajEndMs = parseWindow(p.ends_at)?.getTime() ?? null;
      }
    }
  } else {
    const { data: config } = await client
      .from("cycle_config")
      .select(
        "pod_registration_close, phase_2_start, project_registration_close"
      )
      .eq("cycle_id", cycleId)
      .maybeSingle();
    formingEndMs = parseWindow(config?.pod_registration_close)?.getTime() ?? null;
    ajStartMs = parseWindow(config?.phase_2_start)?.getTime() ?? null;
    ajEndMs =
      parseWindow(config?.project_registration_close)?.getTime() ?? null;
    if (ajStartMs !== null && ajEndMs !== null && ajStartMs >= ajEndMs) {
      ajStartMs = null;
      ajEndMs = null;
    }
  }

  return deriveRegistrationWindow(
    { formingEndMs, activeJoinStartMs: ajStartMs, activeJoinEndMs: ajEndMs },
    now.getTime()
  );
}
