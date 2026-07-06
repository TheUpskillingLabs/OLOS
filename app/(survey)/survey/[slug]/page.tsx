import { notFound } from "next/navigation";
import { getOpenFieldSurvey } from "@/lib/content/surveys";
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
      "Share what you're seeing in the field — the observations that shape what we build.",
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

  return (
    <SurveyFlow
      slug={survey.share_slug}
      domain={survey.problem_domain ?? "the field"}
      about={survey.about}
    />
  );
}
