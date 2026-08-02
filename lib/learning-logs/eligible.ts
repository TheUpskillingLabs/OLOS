import { createServiceClient } from "@/lib/supabase/server";
import type { ParticipantStatus } from "@/lib/auth/roles";

/* The single definition of "cycles this member can log against": every
   currently active cycle (any mode — org cycles included, migration 00060)
   intersected with the member's own enrollment in it. Three call sites used
   to run near-duplicates of this pair of queries and drifted
   (lib/learning-logs/gate.ts's gate prologue, app/api/learning-logs/route.ts's
   resolveEligibleCycles, and app/(dashboard)/dashboard/page.tsx's inline
   two-mode list) — this is now the only place that answers the question, so
   a mode='closed' active-cycle enrollment (or any future mode) is handled
   identically everywhere instead of only wherever someone remembered to
   list it.

   Eligibility (who may FILE a log) spans every in-cohort status —
   'registered' (committed, pre-pod), 'active' (in a pod), and 'inactive'
   (an engagement exit). Registered members log because logging is available
   from the moment someone joins the cohort, before pods form; inactive
   members log because a qualifying log is exactly what RECOVERS them to
   'active' (app/api/learning-logs/route.ts). Only 'revoked' (hard archive) is
   excluded. The weekly-log LOCK is narrower: gate.ts asks for
   statuses:['active'] only, so a pre-pod 'registered' member can log but is
   never locked out. Each returned cycle carries the member's enrollment
   `status` so the gate can filter a wide precomputed list down to the
   active-only lockable set. */

export interface EligibleLogCycle {
  id: number;
  name: string;
  mode: string;
  /** The member's cycle_enrollments.status for this cycle. */
  status: ParticipantStatus;
}

const DEFAULT_STATUSES: ParticipantStatus[] = [
  "registered",
  "active",
  "inactive",
];

export async function eligibleLogCycles(
  participantId: number,
  opts: { statuses?: ParticipantStatus[] } = {}
): Promise<EligibleLogCycle[]> {
  const statuses = opts.statuses ?? DEFAULT_STATUSES;
  const supabase = createServiceClient();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, name, mode")
    .eq("status", "active");
  if (!cycles || cycles.length === 0) return [];

  const cycleIds = cycles.map((c) => c.id);

  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select("cycle_id, status")
    .eq("participant_id", participantId)
    .in("status", statuses)
    .in("cycle_id", cycleIds);
  const statusByCycle = new Map<number, ParticipantStatus>(
    (enrollments ?? []).map((e) => [e.cycle_id, e.status as ParticipantStatus])
  );

  return cycles
    .filter((c) => statusByCycle.has(c.id))
    .map((c) => ({ ...c, status: statusByCycle.get(c.id) as ParticipantStatus }));
}
