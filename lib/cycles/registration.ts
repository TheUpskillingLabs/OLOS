import { SupabaseClient } from "@supabase/supabase-js";
import { checkWindow } from "@/lib/auth/windows";

// "Open for registration" = the cycle's registration window
// (cycle_config.registration_open / registration_close) contains now. This is
// deliberately independent of `status`, so a cycle can accept sign-ups while
// still `upcoming` (before it goes `active`). Product invariant: at most one
// cycle is open for registration at a time; if windows overlap we prefer the
// soonest-starting cycle.

export interface RegistrationCycle {
  id: number;
  name: string;
  start_date: string;
  status: string;
}

type ConfigRow = {
  registration_open: string | null;
  registration_close: string | null;
};

function windowOpen(cfg: ConfigRow | null | undefined, now: number): boolean {
  if (!cfg?.registration_open || !cfg?.registration_close) return false;
  const open = new Date(cfg.registration_open).getTime();
  const close = new Date(cfg.registration_close).getTime();
  return now >= open && now <= close;
}

/** The single cycle currently open for registration, or null. */
export async function getRegistrationCycle(
  supabase: SupabaseClient
): Promise<RegistrationCycle | null> {
  const { data } = await supabase
    .from("cycles")
    .select(
      "id, name, start_date, status, cycle_config(registration_open, registration_close)"
    )
    .order("start_date", { ascending: true });

  const now = Date.now();
  for (const c of (data as unknown as Array<Record<string, unknown>>) ?? []) {
    const raw = c.cycle_config;
    const cfg = (Array.isArray(raw) ? raw[0] : raw) as ConfigRow | undefined;
    if (windowOpen(cfg, now)) {
      return {
        id: c.id as number,
        name: c.name as string,
        start_date: c.start_date as string,
        status: c.status as string,
      };
    }
  }
  return null;
}

/** Is this specific cycle currently open for registration? */
export async function isCycleOpenForRegistration(
  supabase: SupabaseClient,
  cycleId: number
): Promise<boolean> {
  const { open } = await checkWindow(supabase, cycleId, "registration");
  return open;
}
