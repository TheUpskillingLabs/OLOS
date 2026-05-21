import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getResendClient, FROM_EMAIL } from "@/lib/email";
import {
  pulseReminderEmailHtml,
  pulseReminderEmailText,
  pulseReminderSubject,
  type PulseReminderVariant,
} from "@/lib/email/pulse-check-reminder-template";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEND_DELAY_MS = 200;

type Outcome = {
  participant_id: number;
  variant: PulseReminderVariant;
  status: "sent" | "error";
  error?: string;
};

function variantForDeadline(
  msUntilDeadline: number
): PulseReminderVariant | null {
  const daysUntilDeadline = Math.ceil(msUntilDeadline / ONE_DAY_MS);
  if (msUntilDeadline <= 0) return "final";
  if (daysUntilDeadline === 1) return "one_day";
  if (daysUntilDeadline === 3) return "three_day";
  return null;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error(
      "[pulse-check-reminder] NEXT_PUBLIC_APP_URL is not set — aborting before any send"
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
    .select("id")
    .eq("status", "active");

  const cycleIds = (cycles || []).map((c) => c.id);
  if (cycleIds.length === 0) {
    return NextResponse.json({
      sent_count: 0,
      outcomes: [],
      timestamp: new Date().toISOString(),
    });
  }

  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select(
      "participant_id, participants:participant_id(id, email, last_pulse_completed_at, created_at)"
    )
    .in("cycle_id", cycleIds)
    .eq("status", "active");

  const pulseCheckUrl = `${appUrl}/pulse-check`;
  const resend = getResendClient();

  const seen = new Set<number>();
  const outcomes: Outcome[] = [];

  for (const enrollment of enrollments || []) {
    const participant = Array.isArray(enrollment.participants)
      ? enrollment.participants[0]
      : enrollment.participants;
    if (!participant) continue;
    if (seen.has(participant.id)) continue;
    seen.add(participant.id);

    const baseline =
      participant.last_pulse_completed_at ?? participant.created_at;
    if (!baseline) continue;
    if (!participant.email) continue;

    const deadlineMs = new Date(baseline).getTime() + 7 * ONE_DAY_MS;
    const variant = variantForDeadline(deadlineMs - now);
    if (!variant) continue;

    try {
      const { error: sendError } = await resend.emails.send({
        from: FROM_EMAIL,
        to: participant.email,
        subject: pulseReminderSubject(variant),
        html: pulseReminderEmailHtml({ variant, pulseCheckUrl }),
        text: pulseReminderEmailText({ variant, pulseCheckUrl }),
      });

      if (sendError) {
        console.error(
          `[pulse-check-reminder] send failed participant_id=${participant.id} variant=${variant} error=${sendError.message ?? String(sendError)}`
        );
        outcomes.push({
          participant_id: participant.id,
          variant,
          status: "error",
          error: sendError.message ?? String(sendError),
        });
      } else {
        console.log(
          `[pulse-check-reminder] sent participant_id=${participant.id} variant=${variant}`
        );
        outcomes.push({ participant_id: participant.id, variant, status: "sent" });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `[pulse-check-reminder] exception participant_id=${participant.id} variant=${variant} error=${message}`
      );
      outcomes.push({
        participant_id: participant.id,
        variant,
        status: "error",
        error: message,
      });
    }

    await new Promise((r) => setTimeout(r, SEND_DELAY_MS));
  }

  const sentCount = outcomes.filter((o) => o.status === "sent").length;
  const errorCount = outcomes.filter((o) => o.status === "error").length;

  return NextResponse.json({
    sent_count: sentCount,
    error_count: errorCount,
    breakdown: {
      three_day: outcomes.filter((o) => o.variant === "three_day" && o.status === "sent").length,
      one_day: outcomes.filter((o) => o.variant === "one_day" && o.status === "sent").length,
      final: outcomes.filter((o) => o.variant === "final" && o.status === "sent").length,
    },
    outcomes,
    timestamp: new Date().toISOString(),
  });
}
