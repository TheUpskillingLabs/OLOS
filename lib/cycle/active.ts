import type { SupabaseClient } from "@supabase/supabase-js";

/* Which cycle? The flat "the active cycle" splits in the sector model
   (SECTOR_MODEL.md §8):
     - getOperatingCycle → the one running cohort (status='active'). The
       dashboard, the learning-log gate, formation, and crons want this.
     - getRecruitingCycle → where a NEW signup enrolls: the upcoming cohort if
       one is open, else the active one (until the member-registration window
       lands in Phase B). The signup funnel + join flow target this.
   Both assume the ≤1-active / ≤1-upcoming invariants (migrations 00048/00049),
   so `.maybeSingle()` is safe. */

const CYCLE_COLUMNS = "id, name, slug, start_date, end_date, status, sector_id";

export interface CycleRow {
  id: number;
  name: string;
  slug: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  sector_id: number | null;
}

export async function getOperatingCycle(
  supabase: SupabaseClient
): Promise<CycleRow | null> {
  const { data } = await supabase
    .from("cycles")
    .select(CYCLE_COLUMNS)
    .eq("status", "active")
    .maybeSingle();
  return (data as CycleRow | null) ?? null;
}

export async function getRecruitingCycle(
  supabase: SupabaseClient
): Promise<CycleRow | null> {
  const { data: upcoming } = await supabase
    .from("cycles")
    .select(CYCLE_COLUMNS)
    .eq("status", "upcoming")
    .maybeSingle();
  if (upcoming) return upcoming as CycleRow;
  return getOperatingCycle(supabase);
}
