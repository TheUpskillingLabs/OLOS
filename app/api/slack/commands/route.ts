import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifySlackSignature } from "@/lib/integrations/slack-signature";
import { slackEnabled, openModal } from "@/lib/integrations/slack";
import { getRecentLogs } from "@/lib/learning-logs/logs";
import {
  learningLogModalView,
  recentLogsBlocks,
} from "@/lib/integrations/slack-messages";

/* Slack slash command `/learninglog` (issue #189). This is an unauthenticated
   public endpoint (/api/ is public in proxy.ts), so it authenticates the
   request itself via the Slack signature over the RAW body — read with
   request.text() BEFORE parsing. Identity: the incoming Slack user_id is mapped
   to a participant via the slack_user_id the verification cron resolved.

   Slack requires a response within 3s, so the write-heavy work (opening a
   modal) is a quick views.open call and the actual log write happens later on
   the interactivity callback (see ../interactivity/route.ts). */

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const ok = verifySlackSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? "",
    rawBody,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
  });
  if (!ok) return new NextResponse("invalid signature", { status: 401 });

  if (!slackEnabled()) {
    return ephemeral("Slack isn't fully configured yet — reach out to a moderator.");
  }

  const params = new URLSearchParams(rawBody);
  const text = (params.get("text") ?? "").trim().toLowerCase();
  const slackUserId = params.get("user_id");
  const triggerId = params.get("trigger_id");

  if (!slackUserId) return ephemeral("Couldn't read your Slack identity — try again.");

  const service = createServiceClient();
  const { data: participant } = await service
    .from("participants")
    .select("id")
    .eq("slack_user_id", slackUserId)
    .maybeSingle();

  if (!participant) {
    return ephemeral(
      "We couldn't link your Slack account to OLOS yet. Make sure you joined the Slack with the same email you use for OLOS — we sync daily, or ask a moderator to run a sync."
    );
  }

  // `/learninglog view` (or history/list) → show recent entries in Slack.
  if (text === "view" || text === "history" || text === "list") {
    const { logs } = await getRecentLogs(participant.id as number, 5);
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard`;
    return NextResponse.json({
      response_type: "ephemeral",
      blocks: recentLogsBlocks(logs, dashboardUrl),
    });
  }

  // Default (or `submit`) → open the Learning Log modal.
  if (!triggerId) return ephemeral("Couldn't open the form — try again.");
  try {
    await openModal(triggerId, learningLogModalView());
  } catch (e) {
    console.error(
      "[slack-commands] views.open failed:",
      e instanceof Error ? e.message : e
    );
    return ephemeral("Couldn't open the Learning Log form. Try again in a moment.");
  }

  // Empty 200 acks the command; the modal is already opening.
  return new NextResponse(null, { status: 200 });
}

function ephemeral(text: string): NextResponse {
  return NextResponse.json({ response_type: "ephemeral", text });
}
