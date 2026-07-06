import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { slackEnabled } from "@/lib/integrations/slack";
import { verifySlackMembership } from "@/lib/integrations/slack-verification";

// Daily Slack membership + intro verification (issue #189). Resolves each
// active enrollee's Slack account by email (caching slack_user_id), stamps
// slack_joined_at for anyone in the workspace, and slack_intro_at for anyone
// who has posted in #intros. Bearer-guarded like the other cron routes; runs
// on production only (Vercel Cron), with an admin manual-trigger twin at
// /api/admin/slack/verify for dev/preview.

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!slackEnabled()) {
    return NextResponse.json({
      skipped: true,
      reason: "SLACK_BOT_TOKEN not set",
      timestamp: new Date().toISOString(),
    });
  }

  const summary = await verifySlackMembership(createServiceClient());
  console.log(
    `[slack-verification] checked=${summary.checked} resolved=${summary.resolved} joined=${summary.joined} intros=${summary.intros} errors=${summary.errors.length}`
  );
  return NextResponse.json({ ...summary, timestamp: new Date().toISOString() });
}
