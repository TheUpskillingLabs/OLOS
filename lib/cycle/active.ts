import type { SupabaseClient } from "@supabase/supabase-js";

/* Which cycle? The flat "the active cycle" splits in the sector model
   (SECTOR_MODEL.md §8):
     - getOperatingCycle → the one running participant cohort
       (status='active', mode='open'). The dashboard, the learning-log gate,
       formation, and crons want this.
     - getRecruitingCycle → where a NEW signup enrolls: the upcoming
       participant cohort if one is open, else the active one (until the
       member-registration window lands in Phase B). The signup funnel +
       join flow target this.
     - getOrgCycle → the one running HQ/Core-Contributor cycle
       (status='active', mode='org'). Org cycles run in parallel with the
       participant cycle rather than instead of it — see docs/ORG_CYCLES.md.
   Reads here are mode-scoped: `status='active'` alone no longer identifies
   a single row now that an 'open' cycle and an 'org' cycle can both be
   active simultaneously (docs/ORG_CYCLES.md). Each getter narrows by mode,
   so the ≤1-active-per-mode / ≤1-upcoming-per-mode invariants (migrations
   00048/00049/00060) keep `.maybeSingle()` safe. */

const CYCLE_COLUMNS =
  "id, name, slug, start_date, end_date, status, mode, sector_id";

export interface CycleRow {
  id: number;
  name: string;
  slug: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  mode: string;
  sector_id: number | null;
}

export async function getOperatingCycle(
  supabase: SupabaseClient
): Promise<CycleRow | null> {
  const { data } = await supabase
    .from("cycles")
    .select(CYCLE_COLUMNS)
    .eq("status", "active")
    .eq("mode", "open")
    .maybeSingle();
  return (data as CycleRow | null) ?? null;
}

export async function getRecruitingCycle(
  supabase: SupabaseClient
): Promise<CycleRow | null> {
  // The newest cohort open for registration: the most recent `upcoming` cycle
  // (by start date). Ordered + limited rather than assuming a single upcoming
  // row, so the banner still resolves (to the newest) if more than one is ever
  // open, instead of erroring and blanking. Falls back to the running `active`
  // cohort when nothing is upcoming. mode='open' — org cycles are never
  // recruited into via the signup funnel.
  const { data: upcoming } = await supabase
    .from("cycles")
    .select(CYCLE_COLUMNS)
    .eq("status", "upcoming")
    .eq("mode", "open")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (upcoming) return upcoming as CycleRow;
  return getOperatingCycle(supabase);
}

export async function getOrgCycle(
  supabase: SupabaseClient
): Promise<CycleRow | null> {
  // The running HQ/Core-Contributor cycle. Safe as `.maybeSingle()` under
  // the one_active_org_cycle partial unique index (migration 00060).
  const { data } = await supabase
    .from("cycles")
    .select(CYCLE_COLUMNS)
    .eq("status", "active")
    .eq("mode", "org")
    .maybeSingle();
  return (data as CycleRow | null) ?? null;
}
