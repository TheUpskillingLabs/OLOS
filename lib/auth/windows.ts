import { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/supabase/embed";
import { windowOpen, parseWindow } from "@/lib/cycles/lab-time";
import { CYCLE_WINDOWS, type WindowKey } from "@/lib/cycles/windows";

type WindowField = WindowKey;

// Stage 1 calendar overhaul (00085): cycle_phases is the tz-aware read
// model. The legacy pod_registration field maps onto the pod_forming phase
// (pod-registration.md two-window split); every other field key matches its
// phase_key. Stage 2 adds pod_active_join-aware routing per pod status.
// The mapping + messages come from the canonical window registry
// (lib/cycles/windows.ts); checkWindow's decision procedure below is
// unchanged and remains the sole write authorization.
const FIELD_TO_PHASE: Record<WindowField, string> = Object.fromEntries(
  CYCLE_WINDOWS.map((w) => [w.key, w.phaseKey])
) as Record<WindowField, string>;

const WINDOW_MESSAGES: Record<WindowField, string> = Object.fromEntries(
  CYCLE_WINDOWS.map((w) => [w.key, w.closedMessage])
) as Record<WindowField, string>;

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

/**
 * Stage 2 of the calendar overhaul (the TODO at the top of this file): the
 * pod-JOIN window. Pod formation (`pod_forming`) is the primary window, but the
 * `pod_active_join` OVERLAY phase keeps self-serve joining open for people who
 * register after formation closes — last cycle those late registrants landed at
 * enrollment status 'registered' with no pod and no way in except a manual
 * admin add. Joins/leaves remain fully audited either way: pod_memberships
 * stamps joined_at on insert and inactive_at on leave (soft delete), and the
 * reconciler flips the enrollment registered↔active.
 *
 * `via` tells UI callers which window admitted the member, so late-join copy
 * can differ from formation copy. The closed message reuses pod_registration's.
 */
export async function checkPodJoinWindow(
  supabase: SupabaseClient,
  cycleId: number
): Promise<{ open: boolean; message: string; via: "pod_forming" | "pod_active_join" | null }> {
  const forming = await checkWindow(supabase, cycleId, "pod_registration");
  if (forming.open) return { open: true, message: "", via: "pod_forming" };

  // checkWindow already rejected org cycles with its own message — never
  // reopen an org cycle through the overlay.
  if (forming.message === "This action isn't available for organization cycles.") {
    return { open: false, message: forming.message, via: null };
  }

  const { data: phase } = await supabase
    .from("cycle_phases")
    .select("starts_at, ends_at")
    .eq("cycle_id", cycleId)
    .eq("phase_key", "pod_active_join")
    .maybeSingle();

  if (phase) {
    const starts = parseWindow(phase.starts_at);
    const ends = parseWindow(phase.ends_at);
    const now = new Date();
    // [starts_at, ends_at) — same close-exclusive contract as the phases path
    // in checkWindow above.
    if (starts && ends && now >= starts && now < ends) {
      return { open: true, message: "", via: "pod_active_join" };
    }
  }

  return { open: false, message: forming.message, via: null };
}
