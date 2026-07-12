import { SupabaseClient } from "@supabase/supabase-js";
import { one } from "@/lib/supabase/embed";
import { windowOpen } from "@/lib/cycles/lab-time";

type WindowField =
  | "problem_statement"
  | "voting"
  | "pod_registration"
  | "solution_proposal"
  | "solution_voting"
  | "project_registration";

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

  const openTime = configRecord[`${field}_open`] as string | null;
  const closeTime = configRecord[`${field}_close`] as string | null;

  // windowOpen parses the naive columns explicitly as UTC instants (the
  // storage convention) — a bare new Date(naive) would read them in the
  // server's local zone, which diverges between Vercel (UTC) and a dev
  // laptop. See lib/cycles/lab-time.ts.
  if (!windowOpen(openTime, closeTime)) {
    return { open: false, message: WINDOW_MESSAGES[field] };
  }

  return { open: true, message: "" };
}
