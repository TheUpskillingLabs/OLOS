import { createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";

/* The "written in the context of their team's logs" read path
   (docs/ORG_CYCLES.md §4a). Service-role (bypasses RLS), so authorization is
   done HERE and must fail closed: a lead reads ONLY their own team's logs.
   - workstreamLeadContext: the run's members' Learning Logs this week (members
     = active pod_memberships MINUS active co-leads, so a lead never "reads"
     their own absent member row).
   - labLeadContext: the lab's workstream leads' Leadership Logs this week. */

export interface TeamLogEntry {
  participantName: string;
  // Nullable since 00090 (weekly v2 logs don't carry the health check) —
  // org-cycle logs, this module's subject, still write both, but the type
  // follows the column.
  clarity: number | null;
  alignment: number | null;
  is_blocked: boolean;
  blocker_context: string | null;
  accomplished: string | null;
  exploring: string | null;
  next_focus: string | null;
  work_summary?: string | null;
  work_progress?: string | null;
  work_blockers?: string | null;
  created_at: string;
}

type PersonEmbed = {
  first_name: string;
  last_name: string;
  preferred_name: string | null;
};
function personName(p: PersonEmbed | null): string {
  if (!p) return "A teammate";
  return `${p.preferred_name || p.first_name} ${p.last_name}`.trim();
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** A workstream lead reads their run members' Learning Logs for the week.
    Returns null if the caller is not an active co-lead of that pod. */
export async function workstreamLeadContext(
  participantId: number,
  podId: number,
  cycleId: number
): Promise<TeamLogEntry[] | null> {
  const supabase = createServiceClient();

  // Authorize: caller must be an active co-lead of THIS pod in THIS cycle.
  const { data: mod } = await supabase
    .from("moderator_assignments")
    .select("id")
    .eq("participant_id", participantId)
    .eq("pod_id", podId)
    .eq("cycle_id", cycleId)
    .is("removed_at", null)
    .maybeSingle();
  if (!mod) return null;

  // Week window: the org cycle's Learning Log stamp, else trailing 7 days.
  const { data: cfg } = await supabase
    .from("cycle_config")
    .select("log_due_at")
    .eq("cycle_id", cycleId)
    .maybeSingle();
  const since = cfg?.log_due_at
    ? new Date(cfg.log_due_at)
    : new Date(Date.now() - SEVEN_DAYS_MS);

  // Members = active pod_memberships MINUS active co-leads.
  const [{ data: members }, { data: coLeads }] = await Promise.all([
    supabase
      .from("pod_memberships")
      .select("participant_id")
      .eq("pod_id", podId)
      .is("inactive_at", null),
    supabase
      .from("moderator_assignments")
      .select("participant_id")
      .eq("pod_id", podId)
      .eq("cycle_id", cycleId)
      .is("removed_at", null),
  ]);
  const coLeadIds = new Set((coLeads ?? []).map((m) => m.participant_id));
  const memberIds = [
    ...new Set(
      (members ?? [])
        .map((m) => m.participant_id)
        .filter((id) => !coLeadIds.has(id))
    ),
  ];
  if (memberIds.length === 0) return [];

  const { data: logs } = await supabase
    .from("learning_logs")
    .select(
      "clarity, alignment, is_blocked, blocker_context, accomplished, exploring, next_focus, work_summary, work_progress, work_blockers, created_at, participants(first_name, last_name, preferred_name)"
    )
    .eq("cycle_id", cycleId)
    .in("participant_id", memberIds)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  return (logs ?? []).map((l) => ({
    participantName: personName(one(l.participants as PersonEmbed | PersonEmbed[] | null)),
    clarity: l.clarity,
    alignment: l.alignment,
    is_blocked: l.is_blocked,
    blocker_context: l.blocker_context,
    accomplished: l.accomplished,
    exploring: l.exploring,
    next_focus: l.next_focus,
    work_summary: l.work_summary,
    work_progress: l.work_progress,
    work_blockers: l.work_blockers,
    created_at: l.created_at,
  }));
}

/** A lab lead reads their lab's workstream leads' Leadership Logs for the
    week. Returns null if the caller is not an active lead of THIS lab, or the
    cycle isn't that lab's. */
export async function labLeadContext(
  participantId: number,
  labId: number,
  cycleId: number
): Promise<TeamLogEntry[] | null> {
  const supabase = createServiceClient();

  const { data: lead } = await supabase
    .from("lab_leads")
    .select("id")
    .eq("participant_id", participantId)
    .eq("lab_id", labId)
    .is("removed_at", null)
    .maybeSingle();
  if (!lead) return null;

  // Confine to the lab's own org cycle — no cross-lab peeking via a passed id.
  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, lab_id")
    .eq("id", cycleId)
    .maybeSingle();
  if (!cycle || cycle.lab_id !== labId) return null;

  const { data: cfg } = await supabase
    .from("cycle_config")
    .select("leadership_log_due_at")
    .eq("cycle_id", cycleId)
    .maybeSingle();
  const since = cfg?.leadership_log_due_at
    ? new Date(cfg.leadership_log_due_at)
    : new Date(Date.now() - SEVEN_DAYS_MS);

  const { data: logs } = await supabase
    .from("leadership_logs")
    .select(
      "clarity, alignment, is_blocked, blocker_context, accomplished, exploring, next_focus, created_at, participants(first_name, last_name, preferred_name)"
    )
    .eq("cycle_id", cycleId)
    .eq("tier", "workstream_lead")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  return (logs ?? []).map((l) => ({
    participantName: personName(one(l.participants as PersonEmbed | PersonEmbed[] | null)),
    clarity: l.clarity,
    alignment: l.alignment,
    is_blocked: l.is_blocked,
    blocker_context: l.blocker_context,
    accomplished: l.accomplished,
    exploring: l.exploring,
    next_focus: l.next_focus,
    created_at: l.created_at,
  }));
}
