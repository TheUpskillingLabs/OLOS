import { NextResponse, NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { funnelRegistrationSchema } from "@/lib/validations/funnel-registration";
import { findOrCreateWaitlistLab } from "@/lib/labs/membership";
import { getMemberRecruitingCycle } from "@/lib/cycle/active";
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
    process.env.NEXT_PUBLIC_APP_URL || "https://theupskillinglabs.org";

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

  // Resolve the Local Lab decision (docs/LOCAL_LABS.md — the membership
  // spine). Only join_active gives an active-lab metro_id (what unlocks cycle
  // participation); the waitlist branches keep metro_id NULL and record a
  // metro_waitlist_signups row after the participant exists.
  const choice = body.lab_choice;
  let activeLab: { id: number; slug: string } | null = null;
  let waitlistLabId: number | null = null;

  if (choice.kind === "join_active") {
    const { data: lab } = await supabase
      .from("metros")
      .select("id, slug, status")
      .eq("id", choice.metro_id)
      .maybeSingle();
    if (!lab || lab.status !== "active") {
      return NextResponse.json(
        { error: "That lab isn't active — pick an active lab or join its waitlist." },
        { status: 400 }
      );
    }
    activeLab = { id: lab.id, slug: lab.slug };
  } else if (choice.kind === "join_waitlist") {
    const { data: lab } = await supabase
      .from("metros")
      .select("id, status")
      .eq("id", choice.metro_id)
      .maybeSingle();
    if (!lab || lab.status !== "waitlist") {
      return NextResponse.json(
        { error: "That lab isn't accepting a waitlist." },
        { status: 400 }
      );
    }
    waitlistLabId = lab.id;
  } else {
    // start_waitlist — find-or-create the city's waitlist lab. A typed-in city
    // that already exists as active routes to join it instead.
    const { lab, error } = await findOrCreateWaitlistLab(supabase, {
      city: choice.city,
      st: choice.st ?? null,
    });
    if (error || !lab) {
      return NextResponse.json(
        { error: error ?? "Could not start the waitlist" },
        { status: 400 }
      );
    }
    if (lab.status === "active") activeLab = { id: lab.id, slug: lab.slug };
    else waitlistLabId = lab.id;
  }

  // The testing pathway (00042): a tester's full reset deletes their row;
  // the email-keyed grant survives, so re-registration re-flags them.
  const { data: testerGrant } = await supabase
    .from("testers")
    .select("email")
    .eq("email", body.email.toLowerCase())
    .maybeSingle();

  const { data: participant, error: pError } = await supabase
    .from("participants")
    .insert({
      auth_user_id: body.auth_user_id,
      google_id: body.google_id,
      email: body.email,
      first_name: body.first_name,
      last_name: body.last_name,
      zip: body.zip,
      // metro_slug/metro_id are set ONLY when the member joined an ACTIVE lab
      // (docs/LOCAL_LABS.md): metro_id references only active labs, and cycle
      // participation is gated on it. Waitlisted/lab-less members stay NULL.
      metro_slug: activeLab?.slug ?? null,
      metro_id: activeLab?.id ?? null,
      work_situation: body.work_situation,
      source: body.source,
      referred_by: body.referred_by ?? null,
      role_intents: body.role_intents,
      contact_consent: body.contact_consent,
      photo_video_consent: true,
      // Seed the profile photo from the Google OAuth avatar so the directory
      // has a face from day one; members can replace it in profile edit.
      profile_image_url:
        (user.user_metadata?.avatar_url as string | undefined) ||
        (user.user_metadata?.picture as string | undefined) ||
        null,
      agreement_version: body.agreement_version,
      agreement_accepted_at: new Date().toISOString(),
      is_test: !!testerGrant,
    })
    .select("id, created_at")
    .single();

  if (pError) {
    return dbError(pError, "funnel-registration");
  }

  // Waitlist branches: record the signup now that the participant row exists.
  // metro_id stays NULL — they're waiting, not an active member.
  if (waitlistLabId) {
    const { error: sErr } = await supabase
      .from("metro_waitlist_signups")
      .insert({ metro_id: waitlistLabId, participant_id: participant.id });
    if (sErr && sErr.code !== "23505") {
      return dbError(sErr, "funnel-waitlist-signup");
    }
  }

  // Owner is not self-serve — retired with the authorization unification
  // (participant_roles is the rooted source of truth; see migration 00066).

  // Fulfill any pending invitation NOW — an invited new user's callback ran
  // before this participants row existed, so the invite (permissions, cycle
  // enrollment, pod assignment) would otherwise dangle until a later sign-in.
  // The funnel always writes real names, so no placeholder guard is needed.
  await fulfillInvitation(supabase, participant.id, body.email, false);

  // Registration confirmation — point a new signup at the RECRUITING cohort
  // (the upcoming cycle if one is open, else the active one — SECTOR_MODEL §8),
  // and only when its registration window is open. Local Labs
  // (docs/LOCAL_LABS.md): the member's lab's cohort when their lab runs
  // one, else the HQ/global cohort — identical to today until a lab
  // activates its own cycle.
  let emailCycleName: string | null = null;
  let emailCycleJoinUrl: string | null = null;

  // Only active-lab members can register for a cycle (docs/LOCAL_LABS.md), so
  // waitlisted signups get a plain welcome with no cycle CTA to dangle.
  const recruitingCycle = activeLab
    ? await getMemberRecruitingCycle(supabase, activeLab.id)
    : null;

  if (recruitingCycle) {
    const { data: config } = await supabase
      .from("cycle_config")
      .select("pod_registration_open, pod_registration_close")
      .eq("cycle_id", recruitingCycle.id)
      .maybeSingle();

    const now = new Date();
    const isOpen =
      !!config?.pod_registration_open &&
      !!config?.pod_registration_close &&
      now >= new Date(config.pod_registration_open) &&
      now <= new Date(config.pod_registration_close);

    if (isOpen) {
      emailCycleName = recruitingCycle.name;
      emailCycleJoinUrl = `${appUrl}/cycles/${recruitingCycle.id}/join`;
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
    },
    { status: 201 }
  );
}
