import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/* Auto-archive expired announcements (00104). Members stop seeing a post the
   moment expires_at passes — the feed query and the select policy filter on
   it — so this sweep is bookkeeping, not visibility: it flips the row to
   status='archived' so the admin surface and the owner registry's archive
   agree with what members see. Idempotent; a missed run just leaves rows
   'published'-but-hidden until the next one. Registered hourly in
   vercel.json (Vercel Cron only fires on production deployments). */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await createServiceClient()
    .from("announcements")
    .update({ status: "archived" })
    .eq("status", "published")
    .not("expires_at", "is", null)
    .lte("expires_at", nowIso)
    .select("id");

  if (error) {
    console.error(`[announcement-expiry] failed: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const archived = (data ?? []).map((r) => r.id);
  console.log(`[announcement-expiry] archived=${archived.length}`);
  return NextResponse.json({ archived, timestamp: nowIso });
}
