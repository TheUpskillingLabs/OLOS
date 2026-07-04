import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { hashIp, requestIp, windowStart } from "@/lib/api/rate-limit";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { eventRsvpSchema } from "@/lib/validations/event-rsvp";
import { lumaEnabled, addLumaGuest } from "@/lib/integrations/luma";

// Anonymous-path abuse guard (backend doc §8's pre-launch blocker): at most
// this many RSVPs per IP per window. Members are exempt — they're identity-
// bound and deduped by the unique constraint.
const ANON_RSVP_LIMIT = 5;
const ANON_RSVP_WINDOW_MS = 60 * 60 * 1000;

// The event RSVP. Registration parity with Luma (owner decision):
// - Signed-in members register one-tap with their account identity — no
//   body needed, and their email is taken from the session, never trusted
//   from the client. They signed the Participant Agreement (photo clause
//   included) at signup, so API-adding them to Luma's guest list without
//   Luma's registration questions is legitimate.
// - Anonymous visitors on Luma-managed events register on Luma's own page
//   (the UI links them there — Luma asks its questions, photo release
//   included). This endpoint's anonymous email path remains for editorial
//   (non-Luma) events, where it stays public and never account-gated.
// Repeat RSVPs for the same event+email are absorbed silently
// (UNIQUE(event_id, email), migration 00033).
//
// A saved RSVP on a Luma-managed event is forwarded to Luma's guest list —
// confirmations, reminders, and calendar invites come from Luma.
// Forwarding is best-effort: the local row is the fallback record and a
// Luma hiccup never costs anyone their spot (the 6-hourly guest mirror
// also self-heals the other direction).
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

  // Member path: session identity wins over anything in the body.
  let email: string | null = null;
  let guestName: string | undefined;
  let participantId: number | null = null;
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (user?.email) {
      email = user.email.toLowerCase();
      const { data: participant } = await supabase
        .from("participants")
        .select("id, first_name, last_name")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (participant) {
        participantId = participant.id;
        guestName =
          `${participant.first_name} ${participant.last_name}`.trim() ||
          undefined;
      }
    }
  } catch {
    // Signed-out or auth unavailable — fall through to the email body path.
  }

  const ipHash = hashIp(requestIp(request));

  if (!email) {
    // Anonymous path: per-IP window cap before accepting the write.
    const { count } = await supabase
      .from("event_rsvps")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStart(ANON_RSVP_WINDOW_MS));
    if ((count ?? 0) >= ANON_RSVP_LIMIT) {
      return NextResponse.json(
        { error: "Too many RSVPs from this address — try again later." },
        { status: 429 }
      );
    }

    const body = await parseBody(request, eventRsvpSchema);
    if (isErrorResponse(body)) return body;
    // Lowercase so the unique constraint dedupes case variants of one inbox.
    email = body.email.toLowerCase();
  }
  const { error } = await supabase.from("event_rsvps").upsert(
    { event_id: eventId, email, ip_hash: ipHash, participant_id: participantId },
    { onConflict: "event_id,email", ignoreDuplicates: true }
  );
  if (error) return dbError(error, "event-rsvp");

  // Only Luma-managed rows (synced_at set) have a real Luma event behind
  // their api_id — seeded/editorial rows keep their RSVPs local-only.
  let forwardedToLuma = false;
  if (lumaEnabled() && event.synced_at && event.api_id) {
    try {
      await addLumaGuest(event.api_id, email, guestName);
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
