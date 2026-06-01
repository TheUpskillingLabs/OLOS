import { NextResponse, NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { isOwnerEmail, ensureOwnerRole } from "@/lib/auth/owner-emails";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { registrationSchema } from "@/lib/validations/participants";

export async function POST(request: NextRequest) {
  // Verify the user has an active Supabase session
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseBody(request, registrationSchema);
  if (isErrorResponse(body)) return body;

  // Defense in depth: when the long-form sends an auth_user_id, enforce
  // that it matches the actual Supabase session. The field is nullable in
  // the schema (it can also be sent as NULL for legacy / admin-driven
  // imports) — only enforce the match when present.
  if (body.auth_user_id && body.auth_user_id !== user.id) {
    return NextResponse.json(
      { error: "auth_user_id does not match the authenticated session" },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();

  const {
    auth_user_id,
    google_id,
    email,
    first_name,
    last_name,
    preferred_name,
    gender,
    state,
    neighborhood,
    dcpl_card,
    dcpl_info,
    work_situation,
    main_focus,
    sector,
    current_title,
    linkedin,
    ai_tool_familiarity,
    ai_tools,
    labs_goals,
    availability,
    work_style,
    group_strengths,
    participation_commitment,
    primary_expertise,
    volunteer_interest,
    text_updates,
    photo_video_consent,
    source,
    cycle_id,
  } = body;

  // Insert participant
  const { data: participant, error: pError } = await supabase
    .from("participants")
    .insert({
      auth_user_id: auth_user_id || null,
      google_id,
      email,
      first_name,
      last_name,
      preferred_name,
      gender,
      state,
      neighborhood,
      dcpl_card,
      dcpl_info,
      work_situation,
      main_focus,
      sector,
      current_title,
      linkedin,
      ai_tool_familiarity,
      participation_commitment,
      primary_expertise,
      volunteer_interest,
      text_updates,
      photo_video_consent: photo_video_consent ?? true,
      source,
    })
    .select("id, created_at")
    .single();

  if (pError) {
    return dbError(pError, "registration");
  }

  if (isOwnerEmail(email)) {
    await ensureOwnerRole(supabase, participant.id);
  }

  // Insert multiselect options
  const optionIds: number[] = [
    ...(ai_tools || []),
    ...(labs_goals || []),
    ...(availability || []),
    ...(work_style || []),
    ...(group_strengths || []),
  ];

  if (optionIds.length > 0) {
    const rows = optionIds.map((option_id: number) => ({
      participant_id: participant.id,
      option_id,
    }));
    await supabase.from("participant_options").insert(rows);
  }

  // Enroll in cycle if provided
  if (cycle_id) {
    await supabase.from("cycle_enrollments").insert({
      participant_id: participant.id,
      cycle_id,
      status: "inactive",
    });
  }

  return NextResponse.json(
    { participant_id: participant.id, created_at: participant.created_at },
    { status: 201 }
  );
}
