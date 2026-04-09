import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Get active cycles
  const { data: cycles } = await supabase
    .from("cycles")
    .select("id")
    .eq("status", "active");

  let totalSent = 0;

  for (const cycle of cycles || []) {
    // Get active enrollees
    const { data: enrollments } = await supabase
      .from("cycle_enrollments")
      .select("participant_id")
      .eq("cycle_id", cycle.id)
      .eq("status", "active");

    const scheduledDate = new Date().toISOString().split("T")[0];

    for (const enrollment of enrollments || []) {
      // Create pulse check record if not exists
      const { data: existing } = await supabase
        .from("pulse_checks")
        .select("id")
        .eq("cycle_id", cycle.id)
        .eq("participant_id", enrollment.participant_id)
        .eq("scheduled_date", scheduledDate)
        .maybeSingle();

      if (!existing) {
        await supabase.from("pulse_checks").insert({
          cycle_id: cycle.id,
          participant_id: enrollment.participant_id,
          scheduled_date: scheduledDate,
        });
        totalSent++;
      }
    }
  }

  return NextResponse.json({
    sent_count: totalSent,
    timestamp: new Date().toISOString(),
  });
}
