import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = Date.now();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id")
    .eq("status", "active");

  const cycleIds = (cycles || []).map((c) => c.id);
  if (cycleIds.length === 0) {
    return NextResponse.json({ sent_count: 0, timestamp: new Date().toISOString() });
  }

  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select("participant_id, participants:participant_id(id, email, last_pulse_completed_at, created_at)")
    .in("cycle_id", cycleIds)
    .eq("status", "active");

  const seen = new Set<number>();
  let sent3 = 0;
  let sent1 = 0;
  let sentFinal = 0;

  for (const enrollment of enrollments || []) {
    const participant = Array.isArray(enrollment.participants)
      ? enrollment.participants[0]
      : enrollment.participants;
    if (!participant) continue;
    if (seen.has(participant.id)) continue;
    seen.add(participant.id);

    const baseline =
      participant.last_pulse_completed_at ?? participant.created_at;
    if (!baseline) continue;

    const deadlineMs = new Date(baseline).getTime() + 7 * ONE_DAY_MS;
    const msUntilDeadline = deadlineMs - now;
    const daysUntilDeadline = Math.ceil(msUntilDeadline / ONE_DAY_MS);

    if (daysUntilDeadline === 3) {
      console.log(
        `[pulse-check-reminder] 3-day reminder: ${participant.email}`
      );
      sent3++;
    } else if (daysUntilDeadline === 1) {
      console.log(
        `[pulse-check-reminder] 1-day reminder: ${participant.email}`
      );
      sent1++;
    } else if (msUntilDeadline <= 0) {
      console.log(
        `[pulse-check-reminder] FINAL NOTICE (overdue): ${participant.email}`
      );
      sentFinal++;
    }
  }

  return NextResponse.json({
    sent_count: sent3 + sent1 + sentFinal,
    breakdown: { three_day: sent3, one_day: sent1, final: sentFinal },
    timestamp: new Date().toISOString(),
  });
}
