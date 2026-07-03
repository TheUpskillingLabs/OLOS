import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { eventRsvpSchema } from "@/lib/validations/event-rsvp";

// The public event RSVP — deliberately unauthenticated (owner rule: public
// event RSVPs are email-only, never account-gated). The production twin of
// the prototype's #rsvp-modal submit. Repeat RSVPs for the same event+email
// are absorbed silently (UNIQUE(event_id, email), migration 00033) so the
// caller always sees the same "Spot saved" outcome.
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
    .select("id")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await parseBody(request, eventRsvpSchema);
  if (isErrorResponse(body)) return body;

  // Lowercase so the unique constraint dedupes case variants of one inbox.
  const { error } = await supabase.from("event_rsvps").upsert(
    { event_id: eventId, email: body.email.toLowerCase() },
    { onConflict: "event_id,email", ignoreDuplicates: true }
  );
  if (error) return dbError(error, "event-rsvp");

  return NextResponse.json({ saved: true }, { status: 200 });
}
