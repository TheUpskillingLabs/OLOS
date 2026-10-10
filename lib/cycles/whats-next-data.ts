import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NO_WHATS_NEXT_FACTS,
  type InternalCycleFacts,
  type WhatsNextFacts,
} from "./whats-next";

/* The cycle facts behind the "What's next" message (lib/cycles/whats-next.ts):
   the HQ org cycle that is upcoming or active (the internal Build Cycle, whose
   dates the public pages name as an invitation), and the start_date of the
   upcoming open HQ cycle (which replaces the kickoff constant once that row
   exists). Same filters as getOrgCycle / getRecruitingCycle in
   lib/cycle/active.ts. Either read failing degrades to "no facts", never an
   error on a public page. */

export async function getWhatsNextFacts(
  supabase: SupabaseClient
): Promise<WhatsNextFacts> {
  try {
    const [org, open] = await Promise.all([
      supabase
        .from("cycles")
        .select("name, start_date, end_date, status")
        .eq("mode", "org")
        .is("lab_id", null)
        .in("status", ["active", "upcoming"])
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("cycles")
        .select("start_date")
        .eq("mode", "open")
        .is("lab_id", null)
        .eq("status", "upcoming")
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const o = org.data as (InternalCycleFacts & { status: string }) | null;
    return {
      internalCycle: o
        ? { name: o.name, start_date: o.start_date, end_date: o.end_date }
        : null,
      upcomingPublicStart:
        (open.data as { start_date: string | null } | null)?.start_date ?? null,
    };
  } catch {
    return NO_WHATS_NEXT_FACTS;
  }
}
