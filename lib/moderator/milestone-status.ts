import type { SupabaseClient } from "@supabase/supabase-js";
import { getCycleWeek } from "@/lib/cycle/week";
import {
  MILESTONES,
  type MilestoneKind,
  type MilestoneWeeks,
} from "@/lib/cycle/milestones";

/* Milestone-log status for one pod (Phase 1 — the wk-mid/final evaluations,
   inside the practice). Status ONLY — submitted vs open per member — never a
   grade (shepherd rule). A milestone "opens" once the cycle reaches its
   admin-configured week; before that it reads "opens later". staff/test +
   inactive members are outside the count, like log-health. */

interface MemberInput {
  participant_id: number;
  is_inactive: boolean;
  is_staff_or_test: boolean;
}

export interface MilestoneRow {
  kind: MilestoneKind;
  /** Short label — "Mid-cycle" / "End-cycle". */
  label: string;
  /** The configured cycle week it opens on. */
  week: number;
  /** currentWeek >= week — the evaluation is live. */
  opened: boolean;
  submitted_ids: number[];
  waiting_ids: number[];
}

export interface MilestoneStatus {
  rows: MilestoneRow[];
  total: number;
  /** Null when the cycle has no dates configured. */
  currentWeek: number | null;
}

export async function getMilestoneStatus(
  supabase: SupabaseClient,
  cycleId: number,
  members: MemberInput[]
): Promise<MilestoneStatus> {
  const real = members.filter((m) => !m.is_inactive && !m.is_staff_or_test);
  const ids = real.map((m) => m.participant_id);

  const [{ data: cycle }, { data: cfg }] = await Promise.all([
    supabase.from("cycles").select("start_date, end_date").eq("id", cycleId).maybeSingle(),
    supabase
      .from("cycle_config")
      .select("milestone_mid_week, milestone_final_week")
      .eq("cycle_id", cycleId)
      .maybeSingle(),
  ]);

  const weeks: MilestoneWeeks = {
    milestone_mid_week: cfg?.milestone_mid_week ?? 6,
    milestone_final_week: cfg?.milestone_final_week ?? 12,
  };
  const currentWeek =
    cycle?.start_date && cycle?.end_date
      ? getCycleWeek(new Date(), new Date(cycle.start_date), new Date(cycle.end_date))
      : null;

  const { data: logs } =
    ids.length > 0
      ? await supabase
          .from("learning_logs")
          .select("participant_id, kind")
          .eq("cycle_id", cycleId)
          .in("participant_id", ids)
          .in("kind", MILESTONES.map((m) => m.kind))
      : { data: [] as { participant_id: number; kind: string }[] };

  const rows: MilestoneRow[] = MILESTONES.map((m) => {
    const week = m.weekOf(weeks);
    const submitted = new Set(
      (logs ?? []).filter((l) => l.kind === m.kind).map((l) => l.participant_id)
    );
    return {
      kind: m.kind,
      label: m.short,
      week,
      opened: currentWeek !== null && currentWeek >= week,
      submitted_ids: ids.filter((id) => submitted.has(id)),
      waiting_ids: ids.filter((id) => !submitted.has(id)),
    };
  });

  return { rows, total: ids.length, currentWeek };
}
