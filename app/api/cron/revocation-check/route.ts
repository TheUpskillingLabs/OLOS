import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getResendClient, FROM_EMAIL } from "@/lib/email";
import {
  revocationWarningHtml,
  revocationWarningText,
  revocationWarningSubject,
  type RevocationWarningReason,
} from "@/lib/email/revocation-warning-template";
import { reconcileEnrollmentActivation } from "@/lib/enrollment/reconciler";
// Intentional cross-module import: the at-risk predicate is canonical in
// lib/moderator/nudges.ts (it powers the poderator dashboard's nudge
// surface). Reusing it here means the cron's revocation-candidate
// identification matches what the moderator already sees flagged. If a
// third caller emerges, extract to lib/engagement/at-risk.ts; YAGNI for
// now. See roadmap §3.7 (Phase C design decisions).
import { deriveAtRiskRun } from "@/lib/moderator/nudges";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const SEND_DELAY_MS = 200;

type Outcome = {
  participant_id: number;
  cycle_id: number;
  action: "warned" | "revoked" | "recovered" | "skipped";
  reason?: RevocationWarningReason;
  detail?: string;
};

/**
 * GET /api/cron/revocation-check
 *
 * Two-stage revocation cron rewriting the original buggy implementation
 * (architecture review broken edges #1, #2, #7, #8, #9, #10, #11). The
 * cron is currently UNSCHEDULED in vercel.json (PR #108 removed it
 * during the May Energy hot-fix). Phase C.3 re-registers it after a
 * ≥48h staging soak.
 *
 * What's different from the old route
 * -----------------------------------
 *   1. Cycle-scoped queries. The old route's not_in_pod check counted
 *      pod_memberships across ALL cycles; this one joins to
 *      pods.cycle_id = current_cycle.id (broken edge #1).
 *   2. Window-aware not_in_pod. Only fires AFTER pod_registration_close.
 *      During the open window, being pod-less is expected, not
 *      revocation-worthy. This addresses the launch-time scenario where
 *      late-joiners were getting revoked before they had a chance to
 *      pick a pod.
 *   3. deriveAtRiskRun-driven missed-pulses detection. Uses the canonical
 *      predicate from lib/moderator/nudges.ts compared against
 *      cycle_config.at_risk_consecutive_misses (default 2). Replaces
 *      the old "7 days from created_at fallback" rule.
 *   4. Two-stage warn → revoke with 3-day grace. The cron sends a
 *      warning email and stamps warned_at on the first hit; subsequent
 *      ticks check whether warned_at + 3 days has passed before
 *      calling the reconciler.
 *   5. State changes via reconcileEnrollmentActivation. The cron
 *      doesn't directly mutate cycle_enrollments / pod_memberships /
 *      access_revocations — it asks the Phase A reconciler to demote
 *      the enrollment with logRevocation=true, and the reconciler
 *      handles all the side effects atomically via service client.
 *   6. Admin/owner exemption. Admins and owners with active enrollments
 *      are never revoked by this cron — admins typically have no pod,
 *      and that's by design. (The proper fix for admin participation
 *      tracking lives in #122.)
 *   7. Recovery clears warned_at. If a previously-warned participant
 *      joins a pod or submits a pulse, the next cron tick clears
 *      warned_at so a future warning starts fresh. This is what makes
 *      admin-driven rescue via POST /api/admin/pods/[id]/memberships
 *      compose correctly with the cron — see #123 for the parallel
 *      moderator-add design question.
 *   8. DB-enforced revocation idempotency. Migration 00030 adds a
 *      unique partial index on access_revocations(participant_id,
 *      cycle_id, reason) WHERE revocation_scope = 'full' so the
 *      reconciler's INSERT can safely retry.
 *
 * Auth + observability are unchanged from the existing pattern:
 *   - Bearer CRON_SECRET (same as pulse-check-reminder)
 *   - console.log lines for each outcome (visible in Vercel logs)
 *   - JSON response body summarizes counts + outcomes for monitoring
 *
 * Out of scope (filed separately)
 * --------------------------------
 *   - Admin pulse-check tracking via secret pod or role exemption (#122)
 *   - pulse-check-reminder cron idempotency (#121)
 *   - Moderator pod-membership add power (#123)
 *   - Admin audit columns covering #115's scope
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error(
      "[revocation-check] NEXT_PUBLIC_APP_URL is not set — aborting before any action"
    );
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not set" },
      { status: 500 }
    );
  }

  const supabase = createServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const dashboardUrl = `${appUrl}/dashboard`;
  const pulseUrl = `${appUrl}/pulse-check`;
  const resend = getResendClient();

  const outcomes: Outcome[] = [];

  // Active cycles with their config (pod_registration_close + threshold)
  const { data: cycles } = await supabase
    .from("cycles")
    .select(
      "id, cycle_config(pod_registration_close, at_risk_consecutive_misses)"
    )
    .eq("status", "active");

  for (const cycle of cycles ?? []) {
    const cycleId = cycle.id;
    const config = Array.isArray(cycle.cycle_config)
      ? cycle.cycle_config[0]
      : cycle.cycle_config;
    if (!config) {
      console.warn(
        `[revocation-check] cycle ${cycleId} has no cycle_config; skipping`
      );
      continue;
    }
    const podRegistrationClosed =
      config.pod_registration_close !== null &&
      new Date(config.pod_registration_close).getTime() < now.getTime();
    const missThreshold = config.at_risk_consecutive_misses ?? 2;

    // Active enrollments in this cycle, with the participant's identity,
    // email, current warning state, and role list (for admin exemption).
    // user_roles is filtered to non-revoked rows in the JS layer below;
    // an empty roles array means the participant has no special privileges.
    const { data: enrollments } = await supabase
      .from("cycle_enrollments")
      .select(
        `participant_id,
         warned_at,
         warning_reason,
         participants:participant_id(id, email, first_name, preferred_name,
           user_roles(role, revoked_at))`
      )
      .eq("cycle_id", cycleId)
      .eq("status", "active");

    for (const enrollment of enrollments ?? []) {
      const pid = enrollment.participant_id;
      const participant = Array.isArray(enrollment.participants)
        ? enrollment.participants[0]
        : enrollment.participants;
      if (!participant) continue;

      // Admin/owner exemption (interim until #122 ships the secret-pod
      // or role-exemption design)
      const roles = (participant.user_roles ?? []).filter(
        (r: { role: string; revoked_at: string | null }) =>
          r.revoked_at === null
      );
      const isAdminOrOwner = roles.some(
        (r: { role: string }) => r.role === "admin" || r.role === "owner"
      );
      if (isAdminOrOwner) {
        outcomes.push({
          participant_id: pid,
          cycle_id: cycleId,
          action: "skipped",
          detail: "admin_or_owner_exempt",
        });
        continue;
      }

      // === Reason determination ===

      // Cycle-scoped active pod memberships (fixes architecture review
      // broken edge #1 — old route counted across all cycles)
      const { data: membershipRows } = await supabase
        .from("pod_memberships")
        .select("id, pods!inner(cycle_id)")
        .eq("participant_id", pid)
        .eq("pods.cycle_id", cycleId)
        .is("inactive_at", null);
      const activePodCount = (membershipRows ?? []).length;

      // Pulse history for at-risk run derivation
      const { data: pulseRows } = await supabase
        .from("pulse_checks")
        .select("scheduled_date, completed_at")
        .eq("participant_id", pid)
        .eq("cycle_id", cycleId);

      let reason: RevocationWarningReason | null = null;

      // Reason A: not_in_pod — only AFTER pod_registration_close
      // (window-aware; addresses launch-time late-joiner scenario)
      if (podRegistrationClosed && activePodCount === 0) {
        reason = "not_in_pod";
      }

      // Reason B: missed_pulses — only when the participant DOES have a
      // pod (otherwise reason A applies first) and the consecutive-miss
      // run exceeds the cycle's threshold
      if (!reason && activePodCount > 0) {
        const run = deriveAtRiskRun(pid, pulseRows ?? []);
        if (run && run.consecutiveMisses >= missThreshold) {
          reason = "missed_pulses";
        }
      }

      // === Recovery: clear warned_at if no reason applies but warning was set
      if (!reason && enrollment.warned_at !== null) {
        await supabase
          .from("cycle_enrollments")
          .update({ warned_at: null, warning_reason: null })
          .eq("participant_id", pid)
          .eq("cycle_id", cycleId);
        outcomes.push({
          participant_id: pid,
          cycle_id: cycleId,
          action: "recovered",
          detail: "warning_cleared",
        });
        continue;
      }

      // Nothing to do for this participant
      if (!reason) continue;

      // === Two-stage handler ===

      if (enrollment.warned_at === null) {
        // Stage 1: send warning + stamp warned_at
        const firstName =
          participant.preferred_name || participant.first_name || "there";
        const actionUrl = reason === "missed_pulses" ? pulseUrl : dashboardUrl;
        if (!participant.email) {
          outcomes.push({
            participant_id: pid,
            cycle_id: cycleId,
            action: "skipped",
            detail: "no_email",
          });
          continue;
        }
        try {
          const { error: sendError } = await resend.emails.send({
            from: FROM_EMAIL,
            to: participant.email,
            subject: revocationWarningSubject(reason),
            html: revocationWarningHtml({ reason, actionUrl, firstName }),
            text: revocationWarningText({ reason, actionUrl, firstName }),
          });
          if (sendError) {
            console.error(
              `[revocation-check] warning send failed participant_id=${pid} cycle_id=${cycleId} reason=${reason} error=${sendError.message ?? String(sendError)}`
            );
            outcomes.push({
              participant_id: pid,
              cycle_id: cycleId,
              action: "skipped",
              detail: `send_failed: ${sendError.message ?? "unknown"}`,
            });
            continue;
          }
          await supabase
            .from("cycle_enrollments")
            .update({ warned_at: nowIso, warning_reason: reason })
            .eq("participant_id", pid)
            .eq("cycle_id", cycleId);
          outcomes.push({
            participant_id: pid,
            cycle_id: cycleId,
            action: "warned",
            reason,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.error(
            `[revocation-check] warning exception participant_id=${pid} cycle_id=${cycleId} reason=${reason} error=${message}`
          );
          outcomes.push({
            participant_id: pid,
            cycle_id: cycleId,
            action: "skipped",
            detail: `exception: ${message}`,
          });
        }
        await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
        continue;
      }

      // warned_at IS NOT NULL — check the grace period
      const warnedAtMs = new Date(enrollment.warned_at).getTime();
      if (now.getTime() - warnedAtMs < THREE_DAYS_MS) {
        // Still in grace period
        continue;
      }

      // Stage 2: grace expired — revoke via the reconciler.
      // The reconciler reads current pod-membership reality and demotes
      // cycle_enrollments.status to 'inactive' if appropriate. Setting
      // logRevocation=true makes it INSERT the access_revocations row.
      // Migration 00030's unique partial index means the INSERT is
      // idempotent even if this cron retries.
      const result = await reconcileEnrollmentActivation(pid, cycleId, {
        reason,
        logRevocation: true,
      });
      console.log(
        `[revocation-check] revoked participant_id=${pid} cycle_id=${cycleId} reason=${reason} before=${result.before} after=${result.after} audited=${result.audited}`
      );
      outcomes.push({
        participant_id: pid,
        cycle_id: cycleId,
        action: "revoked",
        reason,
        detail: `before=${result.before} after=${result.after}`,
      });
    }
  }

  const warnedCount = outcomes.filter((o) => o.action === "warned").length;
  const revokedCount = outcomes.filter((o) => o.action === "revoked").length;
  const recoveredCount = outcomes.filter((o) => o.action === "recovered")
    .length;
  const skippedCount = outcomes.filter((o) => o.action === "skipped").length;

  return NextResponse.json({
    warned_count: warnedCount,
    revoked_count: revokedCount,
    recovered_count: recoveredCount,
    skipped_count: skippedCount,
    breakdown: {
      not_in_pod_warned: outcomes.filter(
        (o) => o.action === "warned" && o.reason === "not_in_pod"
      ).length,
      missed_pulses_warned: outcomes.filter(
        (o) => o.action === "warned" && o.reason === "missed_pulses"
      ).length,
      not_in_pod_revoked: outcomes.filter(
        (o) => o.action === "revoked" && o.reason === "not_in_pod"
      ).length,
      missed_pulses_revoked: outcomes.filter(
        (o) => o.action === "revoked" && o.reason === "missed_pulses"
      ).length,
    },
    outcomes,
    timestamp: nowIso,
  });
}
