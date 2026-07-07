import { DocBar, EditorialHeader } from "@/app/components/chrome/editorial";
import { getPublishedSpotlights } from "@/lib/content/spotlights";
import StoriesClient from "./stories-client";

/* Upskiller Spotlights — public, browse-first (onboarding-proto's stories.html).
   Dark hero + the filterable, expand-in-place spotlight grid + a share-your-
   story submission. Launches empty until real, consented stories are published
   (mirrors the Library's empty-until-real posture). */

// The (public) layout reads request cookies for the auth-aware nav.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upskiller Spotlights · The Upskilling Labs",
  description:
    "Real people, real practice — what changes when you stop consuming education and start building in the open.",
};

export default async function StoriesPage() {
  const spotlights = await getPublishedSpotlights();

  return (
    <>
      <DocBar trail={[["Home", "/"], ["Stories", null]]} tag="The Upskilling Labs" />

      {/* Header: eyebrow + headline (head row), standfirst (row beneath) */}
      <EditorialHeader
        eyebrow="The Upskilling Labs · community"
        title="Upskiller Spotlights"
        standfirst="Real people, real practice — what changes when you stop consuming education and start building in the open."
      />

      <section className="section">
        <div className="container">
          <StoriesClient spotlights={spotlights} />
        </div>
      </section>
    </>
  );
}
