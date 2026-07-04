import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// The weekly gate's arming cron (Phase 1; the production twin of the
// prototype admin panel's "Learning Log gate" toggle). Every Friday it
// stamps cycle_config.log_due_at = now for each active cycle whose gate
// isn't paused; from that moment, active enrollees are locked to the
// dashboard until they save a log at/after the stamp
// (lib/learning-logs/gate.ts). log_gate_paused is the grace/holiday knob —
// paused cycles are skipped AND their stale stamp is cleared so unpausing
// never instantly locks everyone against a weeks-old deadline.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, cycle_config(log_gate_paused)")
    .eq("status", "active");

  const armed: number[] = [];
  const skipped: number[] = [];

  for (const cycle of cycles ?? []) {
    const config = Array.isArray(cycle.cycle_config)
      ? cycle.cycle_config[0]
      : cycle.cycle_config;
    if (config?.log_gate_paused) {
      await supabase
        .from("cycle_config")
        .update({ log_due_at: null })
        .eq("cycle_id", cycle.id);
      skipped.push(cycle.id);
      continue;
    }
    await supabase
      .from("cycle_config")
      .update({ log_due_at: nowIso })
      .eq("cycle_id", cycle.id);
    armed.push(cycle.id);
  }

  return NextResponse.json({
    armed_cycle_ids: armed,
    paused_cycle_ids: skipped,
    log_due_at: armed.length ? nowIso : null,
    timestamp: nowIso,
  });
}
