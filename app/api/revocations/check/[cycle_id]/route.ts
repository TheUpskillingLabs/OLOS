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

      // Check 1: No active pod membership IN THIS CYCLE. Scope the count to the
      // cycle via the pods join — otherwise a stale active membership from a
      // prior cycle keeps podCount > 0 and a genuinely pod-less participant is
      // never flagged (audit fix, matches the cron + add-membership route).
      const { count: podCount } = await auth.supabase
        .from("pod_memberships")
        .select("id, pods!inner(cycle_id)", { count: "exact", head: true })
        .eq("participant_id", pid)
        .is("inactive_at", null)
        .eq("pods.cycle_id", cycleId);

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
          // Only pulses that are actually due — a future-dated (pre-seeded)
          // pulse row is uncompleted-but-not-late and must not count as a miss
          // (audit fix).
          .lte("scheduled_date", now)
          .order("scheduled_date", { ascending: false })
          .limit(2);

        if (checks && checks.length >= 2) {
          const missedConsecutive = checks.every((c) => !c.completed_at);
          if (missedConsecutive) {
            shouldRevoke = true;
            // Match the cron's value ('missed_pulses') so both paths and the
            // admin table's label map agree (audit fix).
            reason = "missed_pulses";
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

      // 4. Record revocation. Capture the insert error instead of swallowing
      // it — the unique partial index can collide on a repeat revoke after a
      // reactivation, and a silent failure hid that de-provisioning happened
      // without a fresh audit row (audit fix).
      const { error: revErr } = await auth.supabase
        .from("access_revocations")
        .insert({
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
      if (revErr) {
        console.error(
          "[revocations-check] access_revocations insert failed for participant",
          pid,
          revErr.message
        );
      }

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
