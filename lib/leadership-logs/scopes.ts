import { createServiceClient } from "@/lib/supabase/server";
import {
  resolveLeadershipScopes,
  type LeadershipScopeInput,
  type LeadershipScopeState,
} from "./tier-logic";

/* Enumerate the Leadership Log scopes a participant occupies across active
   mode='org' cycles (docs/ORG_CYCLES.md §4a):
   - `workstream_lead` per run pod they actively co-lead
     (moderator_assignments, removed_at IS NULL)
   - `lab_lead` per lab they lead (labLeadLabIds) that has an active org cycle
   There is no `member` scope here — the member tier is the Learning Log.
   A person can legitimately hold several scopes (co-lead of N runs, and/or a
   lab lead); each is keyed by (tier, cycle_id, pod_id | lab_id). */
export async function leadershipScopesFor(
  participantId: number,
  labLeadLabIds: number[],
  now: Date = new Date()
): Promise<LeadershipScopeState[]> {
  const supabase = createServiceClient();

  const { data: orgCycles } = await supabase
    .from("cycles")
    .select("id, name, lab_id")
    .eq("status", "active")
    .eq("mode", "org");
  if (!orgCycles || orgCycles.length === 0) return [];
  const cycleIds = orgCycles.map((c) => c.id);

  const { data: configs } = await supabase
    .from("cycle_config")
    .select("cycle_id, leadership_log_due_at, leadership_log_gate_paused")
    .in("cycle_id", cycleIds);
  const cfgByCycle = new Map(
    (configs ?? []).map((c) => [
      c.cycle_id,
      {
        due: c.leadership_log_due_at as string | null,
        paused: !!c.leadership_log_gate_paused,
      },
    ])
  );
  const cycleName = new Map(orgCycles.map((c) => [c.id, c.name as string]));

  const inputs: LeadershipScopeInput[] = [];

  // ── workstream_lead scopes ──
  const { data: mods } = await supabase
    .from("moderator_assignments")
    .select("pod_id, cycle_id")
    .eq("participant_id", participantId)
    .in("cycle_id", cycleIds)
    .is("removed_at", null);

  const modPodIds = [...new Set((mods ?? []).map((m) => m.pod_id))];
  if (modPodIds.length > 0) {
    const { data: runPods } = await supabase
      .from("pods")
      .select("id, cycle_id, workstream_id")
      .in("id", modPodIds)
      .not("workstream_id", "is", null);
    const wsIds = [
      ...new Set((runPods ?? []).map((p) => p.workstream_id as number)),
    ];
    const { data: wsRows } = wsIds.length
      ? await supabase.from("workstreams").select("id, name").in("id", wsIds)
      : { data: [] as { id: number; name: string }[] };
    const wsName = new Map((wsRows ?? []).map((w) => [w.id, w.name]));

    for (const p of runPods ?? []) {
      const cfg = cfgByCycle.get(p.cycle_id);
      inputs.push({
        tier: "workstream_lead",
        cycleId: p.cycle_id,
        cycleName: cycleName.get(p.cycle_id) ?? "",
        podId: p.id,
        labId: null,
        scopeLabel: wsName.get(p.workstream_id as number) ?? "Workstream",
        leadershipLogDueAt: cfg?.due ?? null,
        gatePaused: cfg?.paused ?? false,
        submittedThisWeek: false, // filled below
      });
    }
  }

  // ── lab_lead scopes ──
  const labCycles = orgCycles.filter(
    (c) => c.lab_id != null && labLeadLabIds.includes(c.lab_id)
  );
  if (labCycles.length > 0) {
    const labIds = [...new Set(labCycles.map((c) => c.lab_id as number))];
    const { data: labRows } = await supabase
      .from("metros")
      .select("id, name")
      .in("id", labIds);
    const labName = new Map((labRows ?? []).map((m) => [m.id, m.name]));
    for (const c of labCycles) {
      const cfg = cfgByCycle.get(c.id);
      inputs.push({
        tier: "lab_lead",
        cycleId: c.id,
        cycleName: cycleName.get(c.id) ?? "",
        podId: null,
        labId: c.lab_id as number,
        scopeLabel: labName.get(c.lab_id as number) ?? "Lab",
        leadershipLogDueAt: cfg?.due ?? null,
        gatePaused: cfg?.paused ?? false,
        submittedThisWeek: false, // filled below
      });
    }
  }

  if (inputs.length === 0) return [];

  // ── submitted-this-week per scope ──
  const { data: myLogs } = await supabase
    .from("leadership_logs")
    .select("tier, cycle_id, pod_id, lab_id, created_at")
    .eq("participant_id", participantId)
    .in("cycle_id", cycleIds);

  for (const input of inputs) {
    const due = input.leadershipLogDueAt;
    if (!due) continue; // not armed ⇒ nothing to have satisfied
    input.submittedThisWeek = (myLogs ?? []).some(
      (l) =>
        l.tier === input.tier &&
        l.cycle_id === input.cycleId &&
        (l.pod_id ?? null) === input.podId &&
        (l.lab_id ?? null) === input.labId &&
        l.created_at >= due
    );
  }

  return resolveLeadershipScopes(inputs, now);
}
