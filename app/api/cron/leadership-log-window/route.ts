import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// The org weekly cascade's arming cron (docs/ORG_CYCLES.md §4a). Every
// Wednesday it opens BOTH windows on each active mode='org' cycle:
//   • log_due_at            — the org members' Learning Log (their Wednesday
//     tier; the participant-cycle window is armed Friday elsewhere)
//   • leadership_log_due_at — the leads' cascade; the per-tier target days are
//     derived offsets (workstream_lead +1 = Thu, lab_lead +2 = Fri)
// Each respects its own pause flag (log_gate_paused / leadership_log_gate_paused)
// — a paused window is cleared so unpausing never locks/nags against a stale
// stamp, mirroring the Learning Log cron.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, cycle_config(log_gate_paused, leadership_log_gate_paused)")
    .eq("status", "active")
    .eq("mode", "org");

  const results: {
    cycle_id: number;
    member_armed: boolean;
    leads_armed: boolean;
  }[] = [];

  for (const cycle of cycles ?? []) {
    const config = Array.isArray(cycle.cycle_config)
      ? cycle.cycle_config[0]
      : cycle.cycle_config;
    const memberPaused = !!config?.log_gate_paused;
    const leadPaused = !!config?.leadership_log_gate_paused;

    await supabase
      .from("cycle_config")
      .update({
        log_due_at: memberPaused ? null : nowIso,
        leadership_log_due_at: leadPaused ? null : nowIso,
      })
      .eq("cycle_id", cycle.id);

    results.push({
      cycle_id: cycle.id,
      member_armed: !memberPaused,
      leads_armed: !leadPaused,
    });
  }

  return NextResponse.json({ results, timestamp: nowIso });
}
