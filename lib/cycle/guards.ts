import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Guard for routes whose mechanics only make sense for participant
// ('open') cycles — formation windows, phase fast-forwarding, self-serve
// registration flows. Org cycles (mode='org', docs/ORG_CYCLES.md) are never
// formed by voting and never self-registered: co-leads are assigned via
// moderator_assignments, core contributors are invited directly into
// pod_memberships, and there is no problem-statement/voting/pod-registration
// window to step through. Call this right after resolving the cycle so a
// stray org-cycle id 403s with a clear message instead of corrupting
// cycle_config or the cycle_enrollments/pod_memberships side effects that
// participant-cycle routes assume.
export async function rejectOrgCycle(
  supabase: SupabaseClient,
  cycleId: number,
  message?: string
): Promise<NextResponse | null> {
  const { data: cycle } = await supabase
    .from("cycles")
    .select("mode")
    .eq("id", cycleId)
    .maybeSingle();

  if (!cycle) return null; // let the caller's own 404 handling run

  if (cycle.mode === "org") {
    return NextResponse.json(
      {
        error:
          message ??
          "This action is not available for organization cycles — workstreams are invite-only.",
      },
      { status: 403 }
    );
  }

  return null;
}

// Config keys an org cycle actually uses. Org cycles have no formation
// windows or ballots (docs/ORG_CYCLES.md §5) — the phase-window
// (problem_statement_*/voting_*/pod_registration_*/solution_*/
// project_registration_*) and voting-count (submitter_votes,
// vote_threshold, max_pods, etc.) knobs are inert there, since nothing
// ever reads or stamps them for a mode='org' cycle. Silently accepting a
// PATCH containing them would let a raw API caller believe the write took
// effect when it's actually a no-op, so the config route rejects them
// outright instead.
export const ORG_ALLOWED_CONFIG_KEYS = new Set([
  "pod_limit",
  "milestone_mid_week",
  "milestone_final_week",
  "log_gate_paused",
]);

// Keys in a parsed cycle_config PATCH body that aren't valid for an org
// cycle, sorted for stable error copy. Only own enumerable keys with a
// defined value count — parseBody's zod-stripped output omits keys the
// caller never sent, so those never show up here.
export function orgForbiddenConfigKeys(body: Record<string, unknown>): string[] {
  return Object.keys(body)
    .filter((key) => body[key] !== undefined && !ORG_ALLOWED_CONFIG_KEYS.has(key))
    .sort();
}
