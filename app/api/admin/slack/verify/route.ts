import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { slackEnabled } from "@/lib/integrations/slack";
import { verifySlackMembership } from "@/lib/integrations/slack-verification";

/* Manual Slack verification trigger for admins — the on-demand twin of
   /api/cron/slack-verification. Exists because Vercel Cron only runs on
   production: this is how dev/preview (and impatient admins) resolve Slack
   memberships and intros now instead of at the next scheduled tick. */
export const POST = withAdminAuth(async (_request: NextRequest) => {
  if (!slackEnabled()) {
    return NextResponse.json(
      {
        error:
          "SLACK_BOT_TOKEN is not configured in this environment — add it in Vercel project settings and redeploy.",
      },
      { status: 501 }
    );
  }

  try {
    const summary = await verifySlackMembership(createServiceClient());
    console.log(
      `[admin-slack-verify] checked=${summary.checked} resolved=${summary.resolved} joined=${summary.joined} intros=${summary.intros} errors=${summary.errors.length}`
    );
    return NextResponse.json({ ...summary, timestamp: new Date().toISOString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[admin-slack-verify] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
