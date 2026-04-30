import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id")
    .eq("status", "active");

  let totalRevoked = 0;

  for (const cycle of cycles || []) {
    const { data: enrollments } = await supabase
      .from("cycle_enrollments")
      .select("participant_id, participants:participant_id(last_pulse_completed_at, created_at)")
      .eq("cycle_id", cycle.id)
      .eq("status", "active");

    for (const enrollment of enrollments || []) {
      const pid = enrollment.participant_id;
      const participant = Array.isArray(enrollment.participants)
        ? enrollment.participants[0]
        : enrollment.participants;
      let shouldRevoke = false;
      let reason = "";

      const { count: podCount } = await supabase
        .from("pod_memberships")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", pid)
        .is("inactive_at", null);

      if (!podCount || podCount === 0) {
        shouldRevoke = true;
        reason = "not_in_pod";
      }

      if (!shouldRevoke && participant) {
        const baseline =
          participant.last_pulse_completed_at ?? participant.created_at;
        if (baseline) {
          const baselineMs = new Date(baseline).getTime();
          if (now.getTime() - baselineMs > SEVEN_DAYS_MS) {
            shouldRevoke = true;
            reason = "missed_pulse_check_7day";
          }
        }
      }

      if (!shouldRevoke) continue;

      await supabase
        .from("pod_memberships")
        .update({ inactive_at: nowIso })
        .eq("participant_id", pid)
        .is("inactive_at", null);

      await supabase
        .from("project_memberships")
        .update({ left_at: nowIso })
        .eq("participant_id", pid)
        .eq("cycle_id", cycle.id)
        .is("left_at", null);

      await supabase
        .from("cycle_enrollments")
        .update({ status: "inactive", inactive_date: nowIso })
        .eq("participant_id", pid)
        .eq("cycle_id", cycle.id);

      await supabase.from("access_revocations").insert({
        participant_id: pid,
        cycle_id: cycle.id,
        reason,
        revocation_scope: "full",
        revoked_systems: ["pod_membership", "project_membership", "enrollment"],
      });

      totalRevoked++;
    }
  }

  return NextResponse.json({
    revoked_count: totalRevoked,
    timestamp: new Date().toISOString(),
  });
}
