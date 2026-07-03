import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { eventRsvpSchema } from "@/lib/validations/event-rsvp";
import { lumaEnabled, addLumaGuest } from "@/lib/integrations/luma";

// The public event RSVP — deliberately unauthenticated (owner rule: public
// event RSVPs are email-only, never account-gated). The production twin of
// the prototype's #rsvp-modal submit. Repeat RSVPs for the same event+email
// are absorbed silently (UNIQUE(event_id, email), migration 00033) so the
// caller always sees the same "Spot saved" outcome.
//
// Luma is the source of truth for events, so a saved RSVP is forwarded to
// Luma's guest list — confirmations, reminders, and calendar invites come
// from Luma. Forwarding is best-effort: the local row is the fallback
// record and a Luma hiccup never costs anyone their spot.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ event_id: string }> }
) {
  const { event_id } = await params;
  const eventId = parseIntParam(event_id, "event_id");
  if (eventId instanceof NextResponse) return eventId;

  const supabase = createServiceClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, api_id, synced_at")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await parseBody(request, eventRsvpSchema);
  if (isErrorResponse(body)) return body;

  // Lowercase so the unique constraint dedupes case variants of one inbox.
  const email = body.email.toLowerCase();
  const { error } = await supabase.from("event_rsvps").upsert(
    { event_id: eventId, email },
    { onConflict: "event_id,email", ignoreDuplicates: true }
  );
  if (error) return dbError(error, "event-rsvp");

  // Only Luma-managed rows (synced_at set) have a real Luma event behind
  // their api_id — seeded/editorial rows keep their RSVPs local-only.
  let forwardedToLuma = false;
  if (lumaEnabled() && event.synced_at && event.api_id) {
    try {
      await addLumaGuest(event.api_id, email);
      forwardedToLuma = true;
    } catch (e) {
      console.error(
        `[event-rsvp] Luma forward failed event_id=${eventId}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return NextResponse.json(
    { saved: true, forwarded_to_luma: forwardedToLuma },
    { status: 200 }
  );
}
