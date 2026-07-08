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
   Reads here are mode- AND lab-scoped: with Local Labs (docs/LOCAL_LABS.md)
   each lab runs its own cycle stream, so `status='active' AND mode='open'`
   alone no longer identifies a single row. Every getter takes a `labId`
   (`null` = the HQ/global stream — the default, which reproduces the
   pre-labs behavior exactly), and the per-(mode, lab) partial unique
   indexes (migration 00062) keep `.maybeSingle()` safe within a stream.

   Member-facing code should not pick a stream by hand: use
   getMemberOperatingCycle / getMemberRecruitingCycle, which prefer the
   member's lab (participants.metro_id) and fall back to HQ/global. */

const CYCLE_COLUMNS =
  "id, name, slug, start_date, end_date, status, mode, sector_id, lab_id";

export interface CycleRow {
  id: number;
  name: string;
  slug: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  mode: string;
  sector_id: number | null;
  lab_id: number | null;
}

export async function getOperatingCycle(
  supabase: SupabaseClient,
  labId: number | null = null
): Promise<CycleRow | null> {
  let query = supabase
    .from("cycles")
    .select(CYCLE_COLUMNS)
    .eq("status", "active")
    .eq("mode", "open");
  query = labId === null ? query.is("lab_id", null) : query.eq("lab_id", labId);
  const { data } = await query.maybeSingle();
  return (data as CycleRow | null) ?? null;
}

export async function getRecruitingCycle(
  supabase: SupabaseClient,
  labId: number | null = null
): Promise<CycleRow | null> {
  // The newest cohort open for registration: the most recent `upcoming` cycle
  // (by start date). Ordered + limited rather than assuming a single upcoming
  // row, so the banner still resolves (to the newest) if more than one is ever
  // open, instead of erroring and blanking. Falls back to the running `active`
  // cohort when nothing is upcoming. mode='open' — org cycles are never
  // recruited into via the signup funnel.
  let query = supabase
    .from("cycles")
    .select(CYCLE_COLUMNS)
    .eq("status", "upcoming")
    .eq("mode", "open");
  query = labId === null ? query.is("lab_id", null) : query.eq("lab_id", labId);
  const { data: upcoming } = await query
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (upcoming) return upcoming as CycleRow;
  return getOperatingCycle(supabase, labId);
}

export async function getOrgCycle(
  supabase: SupabaseClient,
  labId: number | null = null
): Promise<CycleRow | null> {
  // The running org-internal cycle — HQ's when labId is null, a lab's own
  // internal track otherwise. Safe as `.maybeSingle()` under the per-(mode,
  // lab) unique index (migration 00062).
  // No call sites yet: the pages that need "the active org cycle" already
  // hold the full cycles list and filter it inline (app/(dashboard)/cycles/page.tsx,
  // the admin cycle workspace) rather than issue an extra query for a row
  // they already have — deliberate, not drift. This helper is for API paths
  // that resolve a cycle without already holding that list.
  let query = supabase
    .from("cycles")
    .select(CYCLE_COLUMNS)
    .eq("status", "active")
    .eq("mode", "org");
  query = labId === null ? query.is("lab_id", null) : query.eq("lab_id", labId);
  const { data } = await query.maybeSingle();
  return (data as CycleRow | null) ?? null;
}

/* Member-facing resolution: a member belongs to their lab's stream when the
   lab runs one, and to the HQ/global stream otherwise. The fallback is what
   makes Local Labs shippable incrementally — until a lab activates its own
   cycle, every member resolves to today's global cohort. */

export async function getMemberOperatingCycle(
  supabase: SupabaseClient,
  metroId: number | null
): Promise<CycleRow | null> {
  if (metroId !== null) {
    const labCycle = await getOperatingCycle(supabase, metroId);
    if (labCycle) return labCycle;
  }
  return getOperatingCycle(supabase, null);
}

export async function getMemberRecruitingCycle(
  supabase: SupabaseClient,
  metroId: number | null
): Promise<CycleRow | null> {
  if (metroId !== null) {
    const labCycle = await getRecruitingCycle(supabase, metroId);
    if (labCycle) return labCycle;
  }
  return getRecruitingCycle(supabase, null);
}
