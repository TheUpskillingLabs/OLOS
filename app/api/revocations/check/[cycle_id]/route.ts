import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { consecutiveMissedLogWeeks } from "@/lib/learning-logs/at-risk";

// Manual (admin-triggered) mirror of the engagement-revocation cron
// (app/api/cron/revocation-check). Under the registered/active model
// (migration 00092) the ONE revocation reason is the missed weekly Learning
// Log cadence for an in-pod ('active') member. Being pod-less is no longer a
// revocation — that member is 'registered', a resting state this active-only
// sweep never sees — so the old "not_in_pod" check was removed.
//
// The signal is missed weekly Learning Log windows (consecutiveMissedLogWeeks,
// reconstructed from the cycle calendar) — identical to the cron, not the
// legacy pulse-check count.
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
    const nowDate = new Date();
    const now = nowDate.toISOString();

    // Cycle calendar (for weekly-window reconstruction) + gate-pause holiday
    // toggle + miss threshold. Without both date bounds there's no cadence to
    // measure; a paused gate exempts the whole cohort.
    const { data: cycle } = await auth.supabase
      .from("cycles")
      .select(
        "start_date, end_date, cycle_config(at_risk_consecutive_misses, log_gate_paused)"
      )
      .eq("id", cycleId)
      .maybeSingle();
    const config = Array.isArray(cycle?.cycle_config)
      ? cycle?.cycle_config[0]
      : cycle?.cycle_config;
    if (!cycle?.start_date || !cycle?.end_date || config?.log_gate_paused) {
      return NextResponse.json({ transitioned_to_inactive: [] });
    }
    const cycleStart = new Date(cycle.start_date);
    const cycleEnd = new Date(cycle.end_date);
    const missThreshold = config?.at_risk_consecutive_misses ?? 2;

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

      // Cadence check: consecutive missed weekly Learning Log windows.
      const { data: logRows } = await auth.supabase
        .from("learning_logs")
        .select("created_at")
        .eq("cycle_id", cycleId)
        .eq("participant_id", pid);
      const missedWeeks = consecutiveMissedLogWeeks(
        nowDate,
        cycleStart,
        cycleEnd,
        (logRows ?? []).map((r) => new Date(r.created_at))
      );
      if (missedWeeks < missThreshold) continue;

      // Flag the enrollment 'inactive' directly and record the audit row.
      const reason = "missed_logs";
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
