import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { reconcileEnrollmentActivation } from "@/lib/enrollment/reconciler";

// Manual (admin-triggered) revocation sweep. Enrollment status is never
// written here — memberships are soft-deleted and the reconciler derives
// the demotion (§3.7: one write path for the enrollment lifecycle). The
// route keeps its own access_revocations insert because it records the
// richer reason + revoked_systems detail, so the reconciler's logRevocation
// stays off to avoid a duplicate audit row.
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

      // Check 1: no active pod membership IN THIS CYCLE. The membership →
      // pod join is required because pod_memberships has no cycle column;
      // an unscoped count would let an active pod in another cycle mask
      // this cycle's absence (the cross-cycle bug class from the May
      // incident — see docs/architecture-review-onboarding-state-machine.md).
      const { data: activeMemberships } = await auth.supabase
        .from("pod_memberships")
        .select("id, pods!inner(cycle_id)")
        .eq("participant_id", pid)
        .eq("pods.cycle_id", cycleId)
        .is("inactive_at", null);

      const membershipIds = (activeMemberships ?? []).map((m) => m.id);
      if (membershipIds.length === 0) {
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
      // 1. Mark THIS CYCLE's pod memberships inactive. Two-step (select ids,
      //    then update by id) because PostgREST embedded filters on an
      //    UPDATE only shape the returned rows — they do not scope the
      //    mutation — so a joined .eq("pods.cycle_id", …) on the update
      //    would soft-delete memberships in every cycle.
      if (membershipIds.length > 0) {
        await auth.supabase
          .from("pod_memberships")
          .update({ inactive_at: now })
          .in("id", membershipIds);
      }

      // 2. Revoke project memberships (project_memberships carries cycle_id)
      await auth.supabase
        .from("project_memberships")
        .update({ left_at: now })
        .eq("participant_id", pid)
        .eq("cycle_id", cycleId)
        .is("left_at", null);

      // 3. Enrollment status follows membership reality via the reconciler —
      //    never written directly here.
      const reconciled = await reconcileEnrollmentActivation(pid, cycleId);

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
        enrollment_status: reconciled.after,
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
