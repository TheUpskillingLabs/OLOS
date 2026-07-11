import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { hashIp, requestIp, windowStart } from "@/lib/api/rate-limit";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import {
  surveySubmissionSchema,
  resolveSurveyResponse,
} from "@/lib/validations/survey-response";
import { getFieldSurveyQuestions } from "@/lib/content/surveys";

// Field-survey observation intake (SENSEMAKING_FLOW.md §3) — the public,
// account-free submission that replaces the Civics & Elections Google Form.
// Gate-free: it's a form + storage, no in-app LLM.
//
// - Signed-in members are bound to their participant_id (from the session,
//   never the body); their name/email default from the account but the form
//   may override the display fields.
// - Anonymous visitors submit freely when the survey allows it — the nullable
//   participant_id is the anonymous path. Per-IP window cap guards abuse,
//   mirroring the event RSVP + story endpoints (lib/api/rate-limit).
// Every response is retained (moderation_status='pending'); curation is a
// later temporal overlay, never a delete (owner decision 2026-07-05).
const ANON_SUBMIT_LIMIT = 10;
const ANON_SUBMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = createServiceClient();

  const { data: survey } = await supabase
    .from("field_surveys")
    .select("id, allow_anonymous, consent_version")
    .eq("share_slug", slug)
    .eq("status", "open")
    .maybeSingle();
  if (!survey) {
    return NextResponse.json(
      { error: "This survey isn't open." },
      { status: 404 }
    );
  }

  // Member path: session identity binds participant_id (trusted from session).
  let participantId: number | null = null;
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (user) {
      const { data: participant } = await supabase
        .from("participants")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (participant) participantId = participant.id;
    }
  } catch {
    // Signed-out or auth unavailable — fall through to the anonymous path.
  }

  if (!participantId && !survey.allow_anonymous) {
    return NextResponse.json(
      { error: "Please sign in to contribute to this survey." },
      { status: 403 }
    );
  }

  const ipHash = hashIp(requestIp(request));

  // Anonymous path: per-IP window cap before accepting the write.
  if (!participantId) {
    const { count } = await supabase
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStart(ANON_SUBMIT_WINDOW_MS));
    if ((count ?? 0) >= ANON_SUBMIT_LIMIT) {
      return NextResponse.json(
        { error: "Thanks — you've submitted a few already. Try again later." },
        { status: 429 }
      );
    }
  }

  const body = await parseBody(request, surveySubmissionSchema);
  if (isErrorResponse(body)) return body;

  // Resolve the generic answer map against the survey's questions: system
  // questions coerce into their typed column, contact fans out to submitter_*,
  // custom questions become answer rows. The consent gate lives here now (a
  // required consent question must be true) — replacing the old z.literal(true).
  const questions = await getFieldSurveyQuestions(survey.id);
  const { envelope, answerRows, error: resolveError } = resolveSurveyResponse(
    questions,
    body.answers
  );
  if (resolveError) {
    return NextResponse.json({ error: resolveError }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("survey_responses")
    .insert({
      field_survey_id: survey.id,
      participant_id: participantId,
      consent_version: survey.consent_version,
      ip_hash: ipHash,
      ...envelope,
    })
    .select("id")
    .single();
  if (error || !inserted) return dbError(error, "survey-response");

  if (answerRows.length > 0) {
    const { error: answersError } = await supabase
      .from("survey_response_answers")
      .insert(
        answerRows.map((a) => ({
          response_id: inserted.id,
          question_id: a.question_id,
          value: a.value,
        }))
      );
    // No client transaction in supabase-js: compensate by removing the
    // envelope row so a submission is never half-written.
    if (answersError) {
      await supabase.from("survey_responses").delete().eq("id", inserted.id);
      return dbError(answersError, "survey-response-answers");
    }
  }

  return NextResponse.json({ submitted: true }, { status: 201 });
}
