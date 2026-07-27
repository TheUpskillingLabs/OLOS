import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

// Manual (admin-triggered) mirror of the engagement-revocation cron
// (app/api/cron/revocation-check). Under the registered/active model
// (migration 00092) the ONE revocation reason is the missed weekly cadence
// for an in-pod ('active') member. Being pod-less is no longer a revocation —
// that member is 'registered', a resting state this active-only sweep never
// sees — so the old "not_in_pod" check was removed.
//
// The reconciler no longer writes exits (it only manages registered <->
// active), so this route sets status='inactive' + inactive_date directly and
// records the audit row. The pod membership is LEFT intact: 'inactive' is an
// engagement flag on a still-in-pod member, and their next qualifying log
// recovers them to 'active' (app/api/learning-logs/route.ts). An admin who
// wants to fully remove someone uses the pod-membership / archive routes.
export const POST = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;
    const now = new Date().toISOString();

    // Get all active enrollees
    const { data: enrollments } = await auth.supabase
      .from("cycle_enrollments")
      .select("participant_id")
      .eq("cycle_id", cycleId)
      .eq("status", "active");

    if (!enrollments || enrollments.length === 0) {
      return NextResponse.json({ transitioned_to_inactive: [] });
    }

    const transitioned = [];

    for (const enrollment of enrollments) {
      const pid = enrollment.participant_id;

      // Cadence check: missed 2+ consecutive pulse checks.
      const { data: checks } = await auth.supabase
        .from("pulse_checks")
        .select("completed_at")
        .eq("cycle_id", cycleId)
        .eq("participant_id", pid)
        .order("scheduled_date", { ascending: false })
        .limit(2);

      const missedConsecutive =
        !!checks && checks.length >= 2 && checks.every((c) => !c.completed_at);
      if (!missedConsecutive) continue;

      // Flag the enrollment 'inactive' directly and record the audit row.
      const reason = "missed_pulse_checks";
      await auth.supabase
        .from("cycle_enrollments")
        .update({ status: "inactive", inactive_date: now })
        .eq("participant_id", pid)
        .eq("cycle_id", cycleId);

      const { error: auditError } = await auth.supabase
        .from("access_revocations")
        .insert({
          participant_id: pid,
          cycle_id: cycleId,
          reason,
          revocation_scope: "full",
          revoked_systems: ["enrollment"],
        });
      if (auditError && auditError.code !== "23505") {
        console.error(
          `[revocations/check] audit insert failed participant_id=${pid} cycle_id=${cycleId} error=${auditError.message ?? String(auditError)}`
        );
      }

      transitioned.push({
        participant_id: pid,
        reason,
        revocation_scope: "full",
        enrollment_status: "inactive",
        systems_affected: ["enrollment"],
      });
    }

    return NextResponse.json({ transitioned_to_inactive: transitioned });
  }
);
