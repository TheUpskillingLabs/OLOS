import { Crumbs } from "@/app/components/content/teasers";
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
      <div className="container">
        <Crumbs trail={[["Home", "/"], ["Stories", null]]} />
      </div>

      {/* Dark hero (the generator's darkHero()) */}
      <section className="grain" style={{ background: "var(--ink)", color: "#fff" }}>
        <div className="reading" style={{ paddingTop: 56, paddingBottom: 56 }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
            The Upskilling Labs · community
          </div>
          <h1 className="t-h1" style={{ maxWidth: "20ch" }}>
            Upskiller Spotlights
          </h1>
          <p className="t-lede" style={{ marginTop: 18, maxWidth: "54ch", color: "var(--od2)" }}>
            Real people, real practice — what changes when you stop consuming education
            and start building in the open.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <StoriesClient spotlights={spotlights} />
        </div>
      </section>
    </>
  );
}
