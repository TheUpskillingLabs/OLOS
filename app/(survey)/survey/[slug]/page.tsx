import { notFound } from "next/navigation";
import {
  getOpenFieldSurvey,
  getFieldSurveyResponseCount,
  getFieldSurveyQuestions,
  RESPONSE_GOAL,
} from "@/lib/content/surveys";
import { createClient } from "@/lib/supabase/server";
import SurveyFlow from "./survey-flow";

/* The public field survey (SENSEMAKING_FLOW.md §3) — account-free, anonymous by
   default. A full-bleed, one-question-at-a-time flow (the (survey) group has no
   nav/footer chrome). This server wrapper resolves the instrument and 404s if
   it isn't open; the flow itself is the client component. */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const survey = await getOpenFieldSurvey(slug);
  if (!survey) return { title: "Field survey · The Upskilling Labs" };
  return {
    title: `${survey.title} · The Upskilling Labs`,
    description:
      survey.about ??
      "Share what you're seeing in the field — a team at The Upskilling Labs builds from it in the next Build Cycle.",
  };
}

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const survey = await getOpenFieldSurvey(slug);
  if (!survey) notFound();

  const [responseCount, questions] = await Promise.all([
    getFieldSurveyResponseCount(survey.id),
    getFieldSurveyQuestions(survey.id),
  ]);
  // An open survey with no questions is misconfigured — the flow needs at least
  // one step. Treat it as not-yet-available rather than crashing the engine.
  if (questions.length === 0) notFound();

  // Signed-in members reach this from the dashboard's first-CTA card. When the
  // submission is done they should return to their portal, not be pitched
  // "Join The Labs" like an anonymous visitor.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isMember = !!user;

  return (
    <SurveyFlow
      slug={survey.share_slug}
      domain={survey.problem_domain ?? "the field"}
      about={survey.about}
      responseCount={responseCount}
      responseGoal={RESPONSE_GOAL}
      questions={questions}
      isMember={isMember}
    />
  );
}
