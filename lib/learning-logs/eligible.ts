import { createServiceClient } from "@/lib/supabase/server";

/* The single definition of "cycles this member can log against": every
   currently active cycle (any mode — org cycles included, migration 00060)
   intersected with the member's own active enrollment in it. Three call
   sites used to run near-duplicates of this pair of queries and drifted
   (lib/learning-logs/gate.ts's gate prologue, app/api/learning-logs/route.ts's
   resolveEligibleCycles, and app/(dashboard)/dashboard/page.tsx's inline
   two-mode list) — this is now the only place that answers the question, so
   a mode='closed' active-cycle enrollment (or any future mode) is handled
   identically everywhere instead of only wherever someone remembered to
   list it. */

export interface EligibleLogCycle {
  id: number;
  name: string;
  mode: string;
}

export async function eligibleLogCycles(
  participantId: number
): Promise<EligibleLogCycle[]> {
  const supabase = createServiceClient();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, mode")
    .eq("status", "active");
  if (!cycles || cycles.length === 0) return [];

  const cycleIds = cycles.map((c) => c.id);

  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select("cycle_id")
    .eq("participant_id", participantId)
    .eq("status", "active")
    .in("cycle_id", cycleIds);
  const enrolledCycleIds = new Set((enrollments ?? []).map((e) => e.cycle_id));

  return cycles.filter((c) => enrolledCycleIds.has(c.id));
}
