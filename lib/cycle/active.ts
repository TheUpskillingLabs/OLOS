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
   Local Labs are SUB-COHORTS of the single HQ participant cycle
   (docs/LOCAL_LABS.md, migration 00067): mode='open' is one HQ stream
   (lab_id NULL — ≤1 active + ≤1 upcoming globally), and a member's metro
   selects their POD (pods.lab_id), never their cycle. Only mode='org'
   remains per-lab — labs run their own internal team cycles — so
   getOrgCycle keeps its labId parameter, and the labId on the open-track
   getters is retained for org callers/symmetry but member routing always
   resolves open to HQ. */

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

/* Member-facing resolution: every member — whatever their lab — belongs to
   the single HQ participant cycle (sub-cohort model, 00067). Labs are
   "automatically enrolled": there is nothing per-lab to activate, and the
   member's metro selects their pod inside the cycle, not the cycle itself.
   The metroId parameter is kept so call sites stay explicit about having
   thought of labs, but it no longer changes the open-track answer. */

export async function getMemberOperatingCycle(
  supabase: SupabaseClient,
  metroId: number | null
): Promise<CycleRow | null> {
  void metroId; // retained so call sites stay explicit about labs (see above)
  return getOperatingCycle(supabase, null);
}

export async function getMemberRecruitingCycle(
  supabase: SupabaseClient,
  metroId: number | null
): Promise<CycleRow | null> {
  void metroId; // retained so call sites stay explicit about labs (see above)
  return getRecruitingCycle(supabase, null);
}
