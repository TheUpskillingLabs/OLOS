import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Get active cycles
  const { data: cycles } = await supabase
    .from("cycles")
    .select("id")
    .eq("status", "active");

  let totalRevoked = 0;

  for (const cycle of cycles || []) {
    const { data: enrollments } = await supabase
      .from("cycle_enrollments")
      .select("participant_id")
      .eq("cycle_id", cycle.id)
      .eq("status", "active");

    for (const enrollment of enrollments || []) {
      const pid = enrollment.participant_id;
      let shouldRevoke = false;
      let reason = "";

      // Check: no active pod
      const { count: podCount } = await supabase
        .from("pod_memberships")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", pid)
        .is("inactive_at", null);

      if (!podCount || podCount === 0) {
        shouldRevoke = true;
        reason = "not_in_pod";
      }

      // Check: missed 2+ consecutive pulse checks
      if (!shouldRevoke) {
        const { data: checks } = await supabase
          .from("pulse_checks")
          .select("completed_at")
          .eq("cycle_id", cycle.id)
          .eq("participant_id", pid)
          .order("scheduled_date", { ascending: false })
          .limit(2);

        if (checks && checks.length >= 2 && checks.every((c) => !c.completed_at)) {
          shouldRevoke = true;
          reason = "missed_pulse_checks";
        }
      }

      if (!shouldRevoke) continue;

      await supabase
        .from("pod_memberships")
        .update({ inactive_at: now })
        .eq("participant_id", pid)
        .is("inactive_at", null);

      await supabase
        .from("project_memberships")
        .update({ left_at: now })
        .eq("participant_id", pid)
        .eq("cycle_id", cycle.id)
        .is("left_at", null);

      await supabase
        .from("cycle_enrollments")
        .update({ status: "inactive", inactive_date: now })
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
