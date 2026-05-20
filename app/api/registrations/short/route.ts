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
        subject: "Your Upskilling Labs account already exists",
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

  // Only include the cycle CTA if there's an active cycle AND its pod-registration
  // window is currently open. If the cycle is active but registration has already
  // closed (or hasn't yet opened), fall back to the no-CTA variant so we don't
  // send users to a dead end.
  let emailCycleName: string | null = null;
  let emailCycleJoinUrl: string | null = null;

  const { data: activeCycle } = await supabase
    .from("cycles")
    .select("id, name")
    .eq("status", "active")
    .maybeSingle();

  if (activeCycle) {
    const { data: config } = await supabase
      .from("cycle_config")
      .select("pod_registration_open, pod_registration_close")
      .eq("cycle_id", activeCycle.id)
      .maybeSingle();

    const now = new Date();
    const isOpen =
      !!config?.pod_registration_open &&
      !!config?.pod_registration_close &&
      now >= new Date(config.pod_registration_open) &&
      now <= new Date(config.pod_registration_close);

    if (isOpen) {
      emailCycleName = activeCycle.name;
      emailCycleJoinUrl = `${appUrl}/cycles/${activeCycle.id}/join`;
    }
  }

  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to The Upskilling Labs",
      html: registrationConfirmationHtml({
        firstName: first_name,
        cycleName: emailCycleName,
        cycleJoinUrl: emailCycleJoinUrl,
      }),
      text: registrationConfirmationText({
        firstName: first_name,
        cycleName: emailCycleName,
        cycleJoinUrl: emailCycleJoinUrl,
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
