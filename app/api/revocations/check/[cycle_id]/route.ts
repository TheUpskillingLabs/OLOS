import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

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
      let shouldRevoke = false;
      let reason = "";

      // Check 1: No active pod membership
      const { count: podCount } = await auth.supabase
        .from("pod_memberships")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", pid)
        .is("inactive_at", null);

      if (!podCount || podCount === 0) {
        shouldRevoke = true;
        reason = "not_in_pod";
      }

      // Check 2: Missed 2+ consecutive pulse checks
      if (!shouldRevoke) {
        const { data: checks } = await auth.supabase
          .from("pulse_checks")
          .select("completed_at")
          .eq("cycle_id", cycleId)
          .eq("participant_id", pid)
          .order("scheduled_date", { ascending: false })
          .limit(2);

        if (checks && checks.length >= 2) {
          const missedConsecutive = checks.every((c) => !c.completed_at);
          if (missedConsecutive) {
            shouldRevoke = true;
            reason = "missed_pulse_checks";
          }
        }
      }

      if (!shouldRevoke) continue;

      // Apply inactive access profile
      // 1. Mark pod memberships inactive
      await auth.supabase
        .from("pod_memberships")
        .update({ inactive_at: now })
        .eq("participant_id", pid)
        .is("inactive_at", null);

      // 2. Revoke project memberships
      await auth.supabase
        .from("project_memberships")
        .update({ left_at: now })
        .eq("participant_id", pid)
        .eq("cycle_id", cycleId)
        .is("left_at", null);

      // 3. Update enrollment status
      await auth.supabase
        .from("cycle_enrollments")
        .update({ status: "inactive", inactive_date: now })
        .eq("participant_id", pid)
        .eq("cycle_id", cycleId);

      // 4. Record revocation
      await auth.supabase.from("access_revocations").insert({
        participant_id: pid,
        cycle_id: cycleId,
        reason,
        revocation_scope: "full",
        revoked_systems: [
          "pod_membership",
          "project_membership",
          "enrollment",
        ],
      });

      transitioned.push({
        participant_id: pid,
        reason,
        revocation_scope: "full",
        systems_affected: [
          "pod_membership",
          "project_membership",
          "enrollment",
        ],
      });
    }

    return NextResponse.json({ transitioned_to_inactive: transitioned });
  }
);
