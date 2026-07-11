import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getResendClient, FROM_EMAIL } from "@/lib/email";
import {
  logReminderEmailHtml,
  logReminderEmailText,
  logReminderSubject,
} from "@/lib/email/learning-log-reminder-template";

// The Learning Log reminder (Phase 1; replaces the pulse-check reminder
// ladder). Stateless single-send idempotency: the daily run only emails
// while the window is younger than 24h — i.e. exactly the first morning
// after the Friday arm — so a locked member gets ONE nudge per window,
// not a daily drip. The gate itself does the enforcing; the email just
// tells them where the door is.
//
// Org cycles (migration 00060) mean a member can be dual-enrolled and
// have more than one cycle due at once. Two passes: first collect every
// due cycle name per participant (still checking each cycle's own
// "already logged" state independently — a log against cycle A never
// suppresses a real reminder for cycle B); then send exactly ONE email
// per participant naming all of their due cycles (B-4).

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEND_DELAY_MS = 200;

type Outcome = {
  participant_id: number;
  status: "sent" | "error";
  error?: string;
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
    .select("id, name, cycle_config(log_due_at, log_gate_paused)")
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

  // Pass 1 — collect every due cycle name per participant. The
  // "already logged" check stays scoped to each cycle's own window, so a
  // log cleared against cycle A never suppresses a still-due reminder for
  // cycle B.
  const dueByParticipant = new Map<
    number,
    { email: string; cycleNames: string[] }
  >();

  for (const cycle of dueCycles) {
    const config = Array.isArray(cycle.cycle_config)
      ? cycle.cycle_config[0]
      : cycle.cycle_config;
    const dueAt = config!.log_due_at as string;

    const { data: enrollments } = await supabase
      .from("cycle_enrollments")
      .select("participant_id, participants:participant_id(id, email)")
      .eq("cycle_id", cycle.id)
      .eq("status", "active");

    for (const enrollment of enrollments ?? []) {
      const participant = Array.isArray(enrollment.participants)
        ? enrollment.participants[0]
        : enrollment.participants;
      if (!participant?.email) continue;

      // Already logged for THIS cycle's window → no reminder for this
      // cycle.
      const { count } = await supabase
        .from("learning_logs")
        .select("id", { count: "exact", head: true })
        .eq("participant_id", participant.id)
        .eq("cycle_id", cycle.id)
        .gte("created_at", dueAt);
      if ((count ?? 0) > 0) continue;

      const existing = dueByParticipant.get(participant.id);
      if (existing) {
        existing.cycleNames.push(cycle.name);
      } else {
        dueByParticipant.set(participant.id, {
          email: participant.email,
          cycleNames: [cycle.name],
        });
      }
    }
  }

  // Pass 2 — one email per participant, naming every cycle collected above.
  for (const [participantId, due] of dueByParticipant) {
    try {
      const { error: sendError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: due.email,
        subject: logReminderSubject(due.cycleNames),
        html: logReminderEmailHtml({ dashboardUrl, cycleNames: due.cycleNames }),
        text: logReminderEmailText({ dashboardUrl, cycleNames: due.cycleNames }),
      });
      if (sendError) {
        console.error(
          `[learning-log-reminder] send failed participant_id=${participantId} error=${sendError.message ?? String(sendError)}`
        );
        outcomes.push({
          participant_id: participantId,
          status: "error",
          error: sendError.message ?? String(sendError),
        });
      } else {
        outcomes.push({ participant_id: participantId, status: "sent" });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `[learning-log-reminder] exception participant_id=${participantId} error=${message}`
      );
      outcomes.push({
        participant_id: participantId,
        status: "error",
        error: message,
      });
    }

    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  return NextResponse.json({
    sent_count: outcomes.filter((o) => o.status === "sent").length,
    error_count: outcomes.filter((o) => o.status === "error").length,
    outcomes,
    timestamp: new Date().toISOString(),
  });
}
