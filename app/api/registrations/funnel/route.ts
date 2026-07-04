import { NextResponse, NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOwnerEmail, ensureOwnerRole } from "@/lib/auth/owner-emails";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { funnelRegistrationSchema } from "@/lib/validations/funnel-registration";
import { metroFromZip } from "@/lib/metros";
import { fulfillInvitation } from "@/lib/auth/invitations";
import { getResendClient, FROM_EMAIL } from "@/lib/email/index";
import {
  registrationConfirmationHtml,
  registrationConfirmationText,
} from "@/lib/email/registration-confirmation-template";
import {
  alreadyRegisteredHtml,
  alreadyRegisteredText,
} from "@/lib/email/already-registered-template";

// The onboarding funnel's registration endpoint — the production twin of the
// prototype’s FLOWS('signup').onComplete write. Superseded /api/registrations/short (deleted)
// (kept for back-compat) with the funnel's extra fields: zip → metro assignment,
// role intents, hear-about source + referral, and the Participant Agreement
// acceptance record.
export async function POST(request: NextRequest) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(request, funnelRegistrationSchema);
  if (isErrorResponse(body)) return body;

  const supabase = createServiceClient();

  // Defense in depth: the body-supplied auth_user_id must match the actual
  // Supabase session (same guard as the short-registration route).
  if (body.auth_user_id !== user.id) {
    return NextResponse.json(
      { error: "auth_user_id does not match the authenticated session" },
      { status: 403 }
    );
  }

  // Case-insensitive dedup check
  const { data: existing } = await supabase
    .from("participants")
    .select("id")
    .ilike("email", body.email)
    .maybeSingle();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://olos.theupskillinglabs.org";

  if (existing) {
    try {
      const resend = getResendClient();
      await resend.emails.send({
        from: FROM_EMAIL,
        to: body.email,
        subject: "Your Upskilling Labs account already exists",
        html: alreadyRegisteredHtml({ loginUrl: `${appUrl}/login` }),
        text: alreadyRegisteredText({ loginUrl: `${appUrl}/login` }),
      });
    } catch {
      // Email failure is non-blocking for dedup response
    }

    return NextResponse.json(
      {
        already_registered: true,
        message: "An account with this email already exists.",
      },
      { status: 200 }
    );
  }

  // The lab is assigned silently from the zip (owner decision — the zip is
  // used for nothing else, and the funnel says so). Resolves from the
  // metros table (migration 00038) — no hardcoded map.
  const metro = await metroFromZip(body.zip);

  const { data: participant, error: pError } = await supabase
    .from("participants")
    .insert({
      auth_user_id: body.auth_user_id,
      google_id: body.google_id,
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      zip: body.zip,
      metro_slug: metro.slug,
      work_situation: body.work_situation,
      source: body.source,
      referred_by: body.referred_by ?? null,
      role_intents: body.role_intents,
      contact_consent: body.contact_consent,
      photo_video_consent: true,
      agreement_version: body.agreement_version,
      agreement_accepted_at: new Date().toISOString(),
    })
    .select("id, created_at")
    .single();

  if (pError) {
    return dbError(pError, "funnel-registration");
  }

  if (isOwnerEmail(body.email)) {
    await ensureOwnerRole(supabase, participant.id);
  }

  // Fulfill any pending invitation NOW — an invited new user's callback ran
  // before this participants row existed, so the invite (permissions, cycle
  // enrollment, pod assignment) would otherwise dangle until a later sign-in.
  // The funnel always writes real names, so no placeholder guard is needed.
  await fulfillInvitation(supabase, participant.id, body.email, false);

  // Registration confirmation — include the cycle CTA only when an active
  // cycle's registration window is open (same logic as the short route).
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
      to: body.email,
      subject: "Welcome to The Upskilling Labs",
      html: registrationConfirmationHtml({
        firstName: body.first_name,
        cycleName: emailCycleName,
        cycleJoinUrl: emailCycleJoinUrl,
      }),
      text: registrationConfirmationText({
        firstName: body.first_name,
        cycleName: emailCycleName,
        cycleJoinUrl: emailCycleJoinUrl,
      }),
    });
  } catch {
    // Email failure is non-blocking for registration
  }

  return NextResponse.json(
    {
      participant_id: participant.id,
      created_at: participant.created_at,
      // The funnel's role branch: picking "Join a Cycle" routes into the
      // cycle registration ceremony when a cycle is open.
      active_cycle_id: activeCycle?.id ?? null,
    },
    { status: 201 }
  );
}
