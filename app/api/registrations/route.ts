import { NextResponse, NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
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

  // Validate required fields
  if (!google_id || !email || !first_name || !last_name || !state || !neighborhood || !dcpl_card || !work_situation || !main_focus || ai_tool_familiarity == null || text_updates == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

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
    return NextResponse.json({ error: pError.message }, { status: 500 });
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
