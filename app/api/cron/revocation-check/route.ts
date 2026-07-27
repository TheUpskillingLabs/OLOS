import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getResendClient, FROM_EMAIL } from "@/lib/email";
import {
  revocationWarningHtml,
  revocationWarningText,
  revocationWarningSubject,
  type RevocationWarningReason,
} from "@/lib/email/revocation-warning-template";
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
 * Registered/active model (migration 00092)
 * ------------------------------------------
 * The one revocation reason is the missed weekly cadence for an in-pod
 * ('active') member. Being pod-less is no longer revocation-worthy — that
 * member is 'registered', a permanent resting state the reconciler settles
 * them into, and the loop below only iterates status='active' enrollments,
 * so the old window-aware "not_in_pod" ladder was removed outright.
 *
 * What's different from the old route
 * -----------------------------------
 *   1. Cycle-scoped queries. The old route's pod check counted
 *      pod_memberships across ALL cycles; this one joins to
 *      pods.cycle_id = current_cycle.id (broken edge #1).
 *   2. deriveAtRiskRun-driven missed-cadence detection. Uses the canonical
 *      predicate from lib/moderator/nudges.ts compared against
 *      cycle_config.at_risk_consecutive_misses (default 2). (Signal
 *      follow-up: this still measures missed PULSE windows; the cadence
 *      with teeth is now the weekly Learning Log — moving the detector
 *      onto missed log windows is tracked separately.)
 *   3. Two-stage warn → revoke with 3-day grace. The cron sends a
 *      warning email and stamps warned_at on the first hit; subsequent
 *      ticks check whether warned_at + 3 days has passed before revoking.
 *   4. The cron is the SOLE writer of 'inactive'. The reconciler no longer
 *      produces exits (it only manages registered <-> active), so stage 2
 *      writes cycle_enrollments.status='inactive' + inactive_date directly
 *      and records the access_revocations audit row. The member's pod
 *      membership is left intact — 'inactive' is an engagement flag, and
 *      their next qualifying log recovers them to 'active'.
 *   5. Admin/owner exemption. Admins and owners with active enrollments
 *      are never revoked by this cron — admins typically have no pod,
 *      and that's by design. (The proper fix for admin participation
 *      tracking lives in #122.)
 *   6. Recovery clears warned_at. If a previously-warned participant
 *      catches up on the cadence, the next cron tick clears warned_at so a
 *      future warning starts fresh. This is what makes admin-driven rescue
 *      via POST /api/admin/pods/[id]/memberships compose correctly with the
 *      cron — see #123 for the parallel moderator-add design question.
 *   7. DB-enforced revocation idempotency. Migration 00030 adds a
 *      unique partial index on access_revocations(participant_id,
 *      cycle_id, reason) WHERE revocation_scope = 'full' so the stage-2
 *      audit INSERT can safely retry.
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

  // Active cycles with their config (cadence-miss threshold). mode='open'
  // only — org cycles have no pulse rows, so the ladder below is structurally
  // inert for them, but scoping here means the warning/revocation emails can
  // never reach staff.
  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, cycle_config(at_risk_consecutive_misses)")
    .eq("status", "active")
    .eq("mode", "open");

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

      // The one revocation reason under the registered/active model: an
      // in-pod ('active') member who fell behind the weekly cadence. Being
      // pod-less is no longer a revocation — that member is 'registered'
      // (the reconciler settles them there) and never enters this loop, which
      // only iterates status='active' enrollments. So the old window-aware
      // "not_in_pod" ladder is gone; a member here always has a pod, hence
      // the activePodCount > 0 guard is now merely defensive against drift.
      //
      // NOTE (signal): deriveAtRiskRun still measures missed PULSE windows.
      // The cadence with teeth is now the weekly Learning Log
      // (lib/learning-logs/gate.ts); moving this detector onto missed
      // learning-log windows is the tracked follow-up. The cron is currently
      // UNSCHEDULED, so this dormant path swaps signal without risk when it
      // lands.
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

      // Stage 2: grace expired — this is the ONE path that writes 'inactive'.
      // The reconciler no longer produces exits (it only manages
      // registered <-> active), so the cron writes the status + inactive_date
      // itself and records the audit row. The pod membership is intentionally
      // LEFT intact: 'inactive' is an engagement flag on a still-in-pod
      // member, and their next qualifying log recovers them to 'active'
      // (app/api/learning-logs/route.ts). Migration 00030's unique partial
      // index (participant_id, cycle_id, reason) keeps the audit insert
      // idempotent across cron retries — a duplicate returns an ignored error
      // rather than a second row.
      await supabase
        .from("cycle_enrollments")
        .update({ status: "inactive", inactive_date: nowIso })
        .eq("participant_id", pid)
        .eq("cycle_id", cycleId);

      const { error: auditError } = await supabase
        .from("access_revocations")
        .insert({
          participant_id: pid,
          cycle_id: cycleId,
          reason,
          revocation_scope: "full",
        });
      if (auditError && auditError.code !== "23505") {
        console.error(
          `[revocation-check] audit insert failed participant_id=${pid} cycle_id=${cycleId} reason=${reason} error=${auditError.message ?? String(auditError)}`
        );
      }

      console.log(
        `[revocation-check] revoked participant_id=${pid} cycle_id=${cycleId} reason=${reason} -> inactive`
      );
      outcomes.push({
        participant_id: pid,
        cycle_id: cycleId,
        action: "revoked",
        reason,
        detail: "status=inactive",
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
