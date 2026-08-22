import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getResendClient, FROM_EMAIL } from "@/lib/email";
import {
  complianceNudgeSubject,
  complianceNudgeEmailHtml,
  complianceNudgeEmailText,
} from "@/lib/email/learning-log-compliance-nudge-template";
import {
  getMemberLogCompliance,
  mostUrgentCompliance,
} from "@/lib/learning-logs/compliance";
import { logComplianceCopy } from "@/lib/learning-logs/compliance-logic";

/**
 * GET /api/cron/learning-log-compliance-nudge
 *
 * The soft-nudge layer's sender. It emails a member who has fallen BEHIND on the
 * weekly Learning Log cadence (missed >= 1 completed week) a firm-but-kind nudge
 * that leads with why the log is in their own interest. It never blocks and never
 * threatens revocation — it fills the gap between the two existing emails:
 *
 *   learning-log-reminder   "this week's log is due"   (only fires <24h after the
 *                            Friday arm, so a member already behind hears nothing)
 *   THIS ONE                "you've fallen behind"     (missed weeks, soft)
 *   revocation-check        "you're at risk"           (the hard warn->revoke cron,
 *                            currently UNSCHEDULED in vercel.json — #213)
 *
 * Scope: status='active' members of an active, mode='open' cycle whose resolved
 * compliance is `behind` or `at_risk` (see lib/learning-logs/compliance-logic.ts).
 * `due_now` is intentionally excluded (the reminder owns it). `at_risk` overlaps
 * the revocation warning's zone — while that cron is dark, this soft nudge is the
 * only voice those members get; WHEN revocation-check is scheduled, decide whether
 * at_risk is nudged here or warned there so a member never gets both in one week.
 *
 * SAFETY — this route sends real email, so it ships conservatively:
 *   - Fail-CLOSED auth. If CRON_SECRET is unset the route 401s instead of
 *     authenticating `Bearer undefined` (the fail-open bug the audit flagged on
 *     the older crons). It also fails fast if NEXT_PUBLIC_APP_URL is missing.
 *   - Dry-run by DEFAULT. Nothing sends unless LOG_COMPLIANCE_NUDGE_ENABLED==="true"
 *     AND the request omits ?dryRun=1. A dry run computes and returns exactly who
 *     WOULD be emailed (and whether idempotency would suppress them) without
 *     sending or writing anything. Run it dry for a cohort week, review, then enable.
 *   - Once-per-window idempotency via the (previously unused) email_log table: a
 *     member with a learning_log_compliance_nudge row in the last 6 days is skipped,
 *     so a daily cron nudges at most once per weekly window, never a daily drip.
 *   - NOT scheduled in vercel.json by this change. Add the entry deliberately after
 *     a dry-run review, the same way #213 gates the revocation cron.
 */

const NUDGE_KIND = "learning_log_compliance_nudge";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = 6 * ONE_DAY_MS;
const SEND_DELAY_MS = 200;

type Outcome = {
  participant_id: number;
  cycle_id: number;
  status: string;
  missed_weeks: number;
  action: "sent" | "would_send" | "suppressed_idempotent" | "error";
  error?: string;
};

export async function GET(request: NextRequest) {
  // Fail-closed: an unset secret must never authenticate a service-role,
  // email-sending route.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[compliance-nudge] CRON_SECRET is not set — refusing to run (fail-closed)"
    );
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 401 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error(
      "[compliance-nudge] NEXT_PUBLIC_APP_URL is not set — aborting before any send"
    );
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not set" },
      { status: 500 }
    );
  }

  const dryRun =
    process.env.LOG_COMPLIANCE_NUDGE_ENABLED !== "true" ||
    request.nextUrl.searchParams.get("dryRun") === "1";

  const supabase = createServiceClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const dashboardUrl = `${appUrl}/dashboard`;

  // Candidate members: active enrollees of active, mode='open' cycles, with the
  // identity fields the email needs. Deduped by participant (a dual-enrolled
  // member is considered once; getMemberLogCompliance picks their most urgent
  // cycle below).
  const { data: cycles } = await supabase
    .from("cycles")
    .select("id")
    .eq("status", "active")
    .eq("mode", "open");
  const cycleIds = (cycles ?? []).map((c) => c.id);
  if (cycleIds.length === 0) {
    return NextResponse.json({
      dry_run: dryRun,
      sent_count: 0,
      outcomes: [],
      timestamp: nowIso,
    });
  }

  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select(
      "participant_id, participants:participant_id(id, email, first_name, preferred_name)"
    )
    .eq("status", "active")
    .in("cycle_id", cycleIds);

  type Candidate = {
    email: string;
    firstName: string | null;
  };
  const candidates = new Map<number, Candidate>();
  for (const e of enrollments ?? []) {
    const p = Array.isArray(e.participants) ? e.participants[0] : e.participants;
    if (!p?.email || candidates.has(p.id)) continue;
    candidates.set(p.id, {
      email: p.email,
      firstName: p.preferred_name || p.first_name || null,
    });
  }

  const resend = getResendClient();
  const outcomes: Outcome[] = [];

  for (const [participantId, candidate] of candidates) {
    // Reuse the single compliance definition; nudge only the "falling behind"
    // spectrum (behind/at_risk), not due_now (the reminder owns that).
    const states = await getMemberLogCompliance(participantId);
    const target = mostUrgentCompliance(
      states.filter((s) => s.nudge && s.status !== "due_now")
    );
    if (!target) continue;

    const copy = logComplianceCopy(target, { cycleName: target.cycleName });
    if (!copy) continue; // defensive — behind/at_risk always yield copy

    // Once-per-window idempotency (email_log). Applies in live mode; in a dry
    // run we still report whether it WOULD suppress, so the review is honest.
    const since = new Date(now - WINDOW_MS).toISOString();
    const { count } = await supabase
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participantId)
      .eq("kind", NUDGE_KIND)
      .gte("sent_at", since);
    const suppressed = (count ?? 0) > 0;

    const baseOutcome = {
      participant_id: participantId,
      cycle_id: target.cycleId,
      status: target.status,
      missed_weeks: target.missedWeeks,
    };

    if (dryRun) {
      outcomes.push({
        ...baseOutcome,
        action: suppressed ? "suppressed_idempotent" : "would_send",
      });
      continue;
    }

    if (suppressed) {
      outcomes.push({ ...baseOutcome, action: "suppressed_idempotent" });
      continue;
    }

    try {
      const subject = complianceNudgeSubject(target.cycleName);
      const { error: sendError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: candidate.email,
        subject,
        html: complianceNudgeEmailHtml({
          headline: copy.headline,
          body: copy.body,
          dashboardUrl,
          ctaLabel: copy.cta,
          firstName: candidate.firstName,
        }),
        text: complianceNudgeEmailText({
          headline: copy.headline,
          body: copy.body,
          dashboardUrl,
          ctaLabel: copy.cta,
          firstName: candidate.firstName,
        }),
      });
      if (sendError) {
        console.error(
          `[compliance-nudge] send failed participant_id=${participantId} error=${sendError.message ?? String(sendError)}`
        );
        outcomes.push({
          ...baseOutcome,
          action: "error",
          error: sendError.message ?? String(sendError),
        });
        continue;
      }

      // Audit + idempotency record in one row (email_log's first writer).
      await supabase.from("email_log").insert({
        kind: NUDGE_KIND,
        participant_id: participantId,
        to_email: candidate.email,
        subject,
        sent_at: nowIso,
        payload: {
          cycle_id: target.cycleId,
          cycle_name: target.cycleName,
          status: target.status,
          missed_weeks: target.missedWeeks,
        },
      });
      outcomes.push({ ...baseOutcome, action: "sent" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `[compliance-nudge] exception participant_id=${participantId} error=${message}`
      );
      outcomes.push({ ...baseOutcome, action: "error", error: message });
    }

    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  return NextResponse.json({
    dry_run: dryRun,
    sent_count: outcomes.filter((o) => o.action === "sent").length,
    would_send_count: outcomes.filter((o) => o.action === "would_send").length,
    suppressed_count: outcomes.filter((o) => o.action === "suppressed_idempotent")
      .length,
    error_count: outcomes.filter((o) => o.action === "error").length,
    outcomes,
    timestamp: nowIso,
  });
}
