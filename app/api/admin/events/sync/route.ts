import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { lumaEnabled, syncLumaEvents } from "@/lib/integrations/luma";

/* Manual Luma sync trigger for admins — the on-demand twin of
   /api/cron/sync-luma-events. Exists because Vercel Cron only runs on
   production: this is how dev environments (and impatient admins) pull
   the calendar now instead of at the next scheduled tick. */
export const POST = withAdminAuth(async (_request: NextRequest) => {
  if (!lumaEnabled()) {
    return NextResponse.json(
      {
        error:
          "LUMA_API_KEY is not configured in this environment — add it in Vercel project settings and redeploy.",
      },
      { status: 501 }
    );
  }

  try {
    const summary = await syncLumaEvents(createServiceClient());
    console.log(
      `[admin-events-sync] fetched=${summary.fetched} created=${summary.created} updated=${summary.updated} errors=${summary.errors.length}`
    );
    return NextResponse.json({
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[admin-events-sync] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
