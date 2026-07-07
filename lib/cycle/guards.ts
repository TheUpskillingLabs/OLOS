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
