import { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/supabase/embed";
import { windowOpen, parseWindow } from "@/lib/cycles/lab-time";

type WindowField =
  | "problem_statement"
  | "voting"
  | "pod_registration"
  | "solution_proposal"
  | "solution_voting"
  | "project_registration";

// Stage 1 calendar overhaul (00085): cycle_phases is the tz-aware read
// model. The legacy pod_registration field maps onto the pod_forming phase
// (pod-registration.md two-window split); every other field key matches its
// phase_key. Stage 2 adds pod_active_join-aware routing per pod status.
const FIELD_TO_PHASE: Record<WindowField, string> = {
  problem_statement: "problem_statement",
  voting: "voting",
  pod_registration: "pod_forming",
  solution_proposal: "solution_proposal",
  solution_voting: "solution_voting",
  project_registration: "project_registration",
};

const WINDOW_MESSAGES: Record<WindowField, string> = {
  problem_statement: "Problem statement submission is not currently open.",
  voting: "Voting is not currently open.",
  pod_registration: "Pod registration is not currently open.",
  solution_proposal: "Solution proposal submission is not currently open.",
  solution_voting: "Solution voting is not currently open.",
  project_registration: "Project registration is not currently open.",
};

export async function checkWindow(
  supabase: SupabaseClient,
  cycleId: number,
  field: WindowField
): Promise<{ open: boolean; message: string }> {
  // Fetch the cycle's mode alongside the config row so this chokepoint
  // never depends on the "org windows are always NULL" invariant — an
  // admin who stamps a window column on an org cycle's cycle_config
  // (nothing stops that today) would otherwise open a formation-only
  // action for a workstream. Org cycles have no formation windows by
  // design (docs/ORG_CYCLES.md); reject before the timestamp logic runs.
  // maybeSingle: a missing cycle_config row must surface as the explicit
  // "configuration not found" message below, not a PostgREST .single() error.
  const { data: config } = await supabase
    .from("cycle_config")
    .select(`${field}_open, ${field}_close, cycles(mode)`)
    .eq("cycle_id", cycleId)
    .maybeSingle();

  if (!config) {
    return { open: false, message: "Cycle configuration not found." };
  }

  const configRecord = config as Record<string, unknown>;
  const cycle = one(configRecord.cycles as { mode: string } | { mode: string }[] | null);
  if (cycle?.mode === "org") {
    return {
      open: false,
      message: "This action isn't available for organization cycles.",
    };
  }

  // Phases-first: when the cycle has phase rows (00085), they are the
  // source for gating — [starts_at, ends_at), per cycle-timeline.md. The
  // admin PATCH keeps them in sync with the legacy columns
  // (lib/cycles/schedule.ts), so this and the fallback agree; the phases
  // path simply wins once rows exist.
  const { data: phase } = await supabase
    .from("cycle_phases")
    .select("starts_at, ends_at")
    .eq("cycle_id", cycleId)
    .eq("phase_key", FIELD_TO_PHASE[field])
    .maybeSingle();

  if (phase) {
    const starts = parseWindow(phase.starts_at);
    const ends = parseWindow(phase.ends_at);
    const now = new Date();
    if (starts && ends && now >= starts && now < ends) {
      return { open: true, message: "" };
    }
    return { open: false, message: WINDOW_MESSAGES[field] };
  }

  const openTime = configRecord[`${field}_open`] as string | null;
  const closeTime = configRecord[`${field}_close`] as string | null;

  // Legacy fallback (no phase rows yet — pre-00085 data or a cycle whose
  // schedule was never synced). windowOpen parses the naive columns
  // explicitly as UTC instants (the storage convention) — a bare
  // new Date(naive) would read them in the server's local zone, which
  // diverges between Vercel (UTC) and a dev laptop. See lib/cycles/lab-time.ts.
  if (!windowOpen(openTime, closeTime)) {
    return { open: false, message: WINDOW_MESSAGES[field] };
  }

  return { open: true, message: "" };
}
