import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getFieldSurveyBySlug, getFieldSurveyQuestions } from "@/lib/content/surveys";
import SurveyBuilder from "./survey-builder";

/* The field-survey question builder (SENSEMAKING_FLOW §8). Admins edit the
   instrument's settings + author/reorder its questions here; the public flow
   renders whatever this defines. */

export const dynamic = "force-dynamic";

export default async function SurveyBuilderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;

  const survey = await getFieldSurveyBySlug(slug);
  if (!survey) notFound();

  const questions = await getFieldSurveyQuestions(survey.id, {
    includeInactive: true,
  });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/surveys"
            className="text-xs font-semibold text-meta hover:text-charcoal"
          >
            &larr; All surveys
          </Link>
          <h1 className="t-h2 mt-1 text-ink">{survey.title}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/survey/${survey.share_slug}/results`}
            className="inline-flex items-center rounded-card border border-ink/15 px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-ink/[0.03]"
          >
            Results &amp; CSV
          </Link>
          <a
            href={`/survey/${survey.share_slug}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center rounded-card border border-ink/15 px-4 py-2 text-sm font-semibold text-charcoal transition-colors hover:bg-ink/[0.03]"
          >
            Preview live &rarr;
          </a>
        </div>
      </div>

      <SurveyBuilder survey={survey} initialQuestions={questions} />
    </div>
  );
}
