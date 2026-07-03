import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { lumaEnabled, syncLumaEvents } from "@/lib/integrations/luma";

/* Scheduled Luma → events cache sync (backend doc §3: never call Luma per
   page view). Registered in vercel.json; Vercel Cron only fires against
   production deployments — on dev, use the admin trigger
   (POST /api/admin/events/sync) instead. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Not an error: environments without a key (or before Luma Plus is
  // active) skip quietly rather than alarming the cron dashboard.
  if (!lumaEnabled()) {
    console.log("[sync-luma-events] LUMA_API_KEY not set — skipping");
    return NextResponse.json({
      skipped: true,
      reason: "LUMA_API_KEY not set",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const summary = await syncLumaEvents(createServiceClient());
    console.log(
      `[sync-luma-events] fetched=${summary.fetched} created=${summary.created} updated=${summary.updated} errors=${summary.errors.length}`
    );
    return NextResponse.json({
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[sync-luma-events] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
