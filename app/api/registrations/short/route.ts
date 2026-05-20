import { NextResponse, NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOwnerEmail, ensureOwnerRole } from "@/lib/auth/owner-emails";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { shortRegistrationSchema } from "@/lib/validations/short-registration";
import { getResendClient, FROM_EMAIL } from "@/lib/email/index";
import {
  registrationConfirmationHtml,
  registrationConfirmationText,
} from "@/lib/email/registration-confirmation-template";
import {
  alreadyRegisteredHtml,
  alreadyRegisteredText,
} from "@/lib/email/already-registered-template";

export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(request, shortRegistrationSchema);
  if (isErrorResponse(body)) return body;

  const supabase = createServiceClient();
  const { auth_user_id, google_id, email, first_name, last_name, contact_consent } = body;

  // Case-insensitive dedup check
  const { data: existing } = await supabase
    .from("participants")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    // Send Email B (already registered) — anonymous greeting
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://olos.theupskillinglabs.org";
    const loginUrl = `${appUrl}/login`;

    try {
      const resend = getResendClient();
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "You already have an account — The Upskilling Labs",
        html: alreadyRegisteredHtml({ loginUrl }),
        text: alreadyRegisteredText({ loginUrl }),
      });
    } catch {
      // Email failure is non-blocking for dedup response
    }

    return NextResponse.json(
      { already_registered: true, message: "An account with this email already exists." },
      { status: 200 }
    );
  }

  // Insert participant with short-form fields only
  const { data: participant, error: pError } = await supabase
    .from("participants")
    .insert({
      auth_user_id,
      google_id,
      email,
      first_name,
      last_name,
      contact_consent,
      photo_video_consent: true,
    })
    .select("id, created_at")
    .single();

  if (pError) {
    return dbError(pError, "short-registration");
  }

  if (isOwnerEmail(email)) {
    await ensureOwnerRole(supabase, participant.id);
  }

  // Send Email A (registration confirmation)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://olos.theupskillinglabs.org";

  // Check for active cycle to include in email
  const { data: activeCycle } = await supabase
    .from("cycles")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();

  const cycleJoinUrl = activeCycle
    ? `${appUrl}/cycles/${activeCycle.id}/join`
    : null;

  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to The Upskilling Labs",
      html: registrationConfirmationHtml({
        firstName: first_name,
        cycleName: activeCycle?.name,
        cycleJoinUrl,
      }),
      text: registrationConfirmationText({
        firstName: first_name,
        cycleName: activeCycle?.name,
        cycleJoinUrl,
      }),
    });
  } catch {
    // Email failure is non-blocking for registration
  }

  return NextResponse.json(
    { participant_id: participant.id, created_at: participant.created_at },
    { status: 201 }
  );
}
