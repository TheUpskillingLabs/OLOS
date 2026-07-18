import { renderSurveyOgCard } from "@/lib/og/survey-card";

/* The field survey's social card, served at a stable URL the survey page's
   generateMetadata points og:image / twitter:image at.

   Why a route handler and not the colocated `opengraph-image.tsx` file
   convention: the survey lives in the `(survey)` route group, and Next gives
   route-group metadata images an opaque, build-dependent URL suffix
   (…/opengraph-image-<hash>). An explicit /api/og/survey/[slug] route keeps the
   URL stable and predictable. The card itself is authored in lib/og/survey-card. */

export const runtime = "nodejs"; // Supabase service client + fs font reads
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  return renderSurveyOgCard(slug);
}
