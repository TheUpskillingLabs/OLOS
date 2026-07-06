import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getResendClient, FROM_EMAIL } from "@/lib/email";
import {
  logReminderEmailHtml,
  logReminderEmailText,
  logReminderSubject,
} from "@/lib/email/learning-log-reminder-template";
import { slackEnabled, sendDirectMessage } from "@/lib/integrations/slack";
import { logReminderSlackText } from "@/lib/integrations/slack-messages";

// The Learning Log reminder (Phase 1; replaces the pulse-check reminder
// ladder). Stateless single-send idempotency: the daily run only emails
// while the window is younger than 24h — i.e. exactly the first morning
// after the Friday arm — so a locked member gets ONE nudge per window,
// not a daily drip. The gate itself does the enforcing; the email just
// tells them where the door is.
//
// Slack DM (issue #189) rides the SAME per-member, once-per-window loop: if
// Slack is configured and the member's slack_user_id is known, they also get
// a bot DM. It's a supplement — a Slack failure is recorded but never blocks
// the email, which is the source of truth for the reminder.

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEND_DELAY_MS = 200;

type Outcome = {
  participant_id: number;
  status: "sent" | "error";
  error?: string;
  slack?: "sent" | "error" | "skipped";
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error(
      "[learning-log-reminder] NEXT_PUBLIC_APP_URL is not set — aborting before any send"
    );
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL is not set" },
      { status: 500 }
    );
  }

  const supabase = createServiceClient();
  const now = Date.now();

  const { data: cycles } = await supabase
    .from("cycles")
    .select("id, cycle_config(log_due_at, log_gate_paused)")
    .eq("status", "active");

  // Cycles whose window is armed, unpaused, and younger than 24h.
  const dueCycles = (cycles ?? []).filter((c) => {
    const config = Array.isArray(c.cycle_config)
      ? c.cycle_config[0]
      : c.cycle_config;
    if (!config?.log_due_at || config.log_gate_paused) return false;
    const age = now - new Date(config.log_due_at).getTime();
    return age >= 0 && age < ONE_DAY_MS;
  });

  if (dueCycles.length === 0) {
    return NextResponse.json({
      sent_count: 0,
      outcomes: [],
      timestamp: new Date().toISOString(),
    });
  }

  const dashboardUrl = `${appUrl}/dashboard`;
  const resend = getResendClient();
  const outcomes: Outcome[] = [];
  const seen = new Set<number>();

  for (const cycle of dueCycles) {
    const config = Array.isArray(cycle.cycle_config)
      ? cycle.cycle_config[0]
      : cycle.cycle_config;
    const dueAt = config!.log_due_at as string;

    const { data: enrollments } = await supabase
      .from("cycle_enrollments")
      .select("participant_id, participants:participant_id(id, email, slack_user_id)")
      .eq("cycle_id", cycle.id)
      .eq("status", "active");

    for (const enrollment of enrollments ?? []) {
      const participant = Array.isArray(enrollment.participants)
        ? enrollment.participants[0]
        : enrollment.participants;
      if (!participant?.email) continue;
      if (seen.has(participant.id)) continue;
      seen.add(participant.id);

      // Already logged this window → no email.
      const { count } = await supabase
        .from("learning_logs")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participant.id)
        .gte("created_at", dueAt);
      if ((count ?? 0) > 0) continue;

      const outcome: Outcome = { participant_id: participant.id, status: "sent" };
      try {
        const { error: sendError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: participant.email,
          subject: logReminderSubject(),
          html: logReminderEmailHtml({ dashboardUrl }),
          text: logReminderEmailText({ dashboardUrl }),
        });
        if (sendError) {
          console.error(
            `[learning-log-reminder] send failed participant_id=${participant.id} error=${sendError.message ?? String(sendError)}`
          );
          outcome.status = "error";
          outcome.error = sendError.message ?? String(sendError);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(
          `[learning-log-reminder] exception participant_id=${participant.id} error=${message}`
        );
        outcome.status = "error";
        outcome.error = message;
      }

      // Supplementary Slack DM — best-effort, never blocks the email outcome.
      if (slackEnabled() && participant.slack_user_id) {
        try {
          await sendDirectMessage(
            participant.slack_user_id,
            logReminderSlackText(dashboardUrl)
          );
          outcome.slack = "sent";
        } catch (e) {
          console.error(
            `[learning-log-reminder] slack DM failed participant_id=${participant.id} error=${e instanceof Error ? e.message : String(e)}`
          );
          outcome.slack = "error";
        }
      } else {
        outcome.slack = "skipped";
      }

      outcomes.push(outcome);
      await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
    }
  }

  return NextResponse.json({
    sent_count: outcomes.filter((o) => o.status === "sent").length,
    error_count: outcomes.filter((o) => o.status === "error").length,
    slack_sent_count: outcomes.filter((o) => o.slack === "sent").length,
    slack_error_count: outcomes.filter((o) => o.slack === "error").length,
    outcomes,
    timestamp: new Date().toISOString(),
  });
}
