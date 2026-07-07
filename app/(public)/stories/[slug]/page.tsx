import Link from "next/link";
import { notFound } from "next/navigation";
import Orb from "@/app/components/chrome/orb";
import {
  getSpotlight,
  getPublishedSpotlights,
  type Spotlight,
  type SpotlightTag,
} from "@/lib/content/spotlights";

/* Upskiller Spotlight detail — each published spotlight gets its own page.
   Dark on-brand hero (photo, or brand gradient + orb) with the pull-quote,
   then the full story, then a "More spotlights" row + a share CTA. Mirrors
   the library/[slug] detail pattern. */

export const dynamic = "force-dynamic";

const TAG_LABELS: Record<SpotlightTag, string> = {
  builder: "Builder",
  mentor: "Mentor",
  career_changer: "Career changer",
  other: "Story",
};

function tagLabel(s: Spotlight): string {
  return s.tag_label || TAG_LABELS[s.tag] || "Story";
}

function imgSrc(url: string): string {
  return /^https?:\/\//.test(url) ? url : `/${url.replace(/^\//, "")}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await getSpotlight(slug);
  if (!s) return { title: "Upskiller Spotlights · The Upskilling Labs" };
  const desc = s.quote || s.story[0] || "";
  return {
    title: `${s.name} · Upskiller Spotlights · The Upskilling Labs`,
    description: desc,
    openGraph: { title: s.name, description: desc, type: "article" },
  };
}

/* The dark hero media — a photo, or the brand gradient with the orb. */
function HeroMedia({ s }: { s: Spotlight }) {
  if (s.image_url) {
    return (
      <div className="media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc(s.image_url)}
          alt={s.name}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 20%",
          }}
        />
      </div>
    );
  }
  return (
    <div className={`media ${s.grad || "m-teal"}`} aria-hidden="true">
      <Orb />
    </div>
  );
}

export default async function SpotlightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const s = await getSpotlight(slug);
  if (!s) notFound();

  const more = (await getPublishedSpotlights())
    .filter((x) => x.slug && x.slug !== s.slug)
    .slice(0, 3);

  return (
    <>
      {/* On-brand dark hero */}
      <section className="grain on-dark" style={{ background: "var(--ink)" }}>
        <div className="container" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <div className="spot-hero">
            <HeroMedia s={s} />
            <div>
              <span className="lbl lbl-teal">{tagLabel(s)}</span>
              {s.quote && <p className="spot-hero-quote">&ldquo;{s.quote}&rdquo;</p>}
              <div className="t-h3">{s.name}</div>
              {s.role && (
                <div className="lbl" style={{ marginTop: 6 }}>
                  {s.role}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* The full story */}
      {s.story.length > 0 && (
        <div className="reading" style={{ paddingTop: 48, paddingBottom: 8 }}>
          {s.story.map((p, i) => (
            <p key={i} className="t-lede" style={{ marginBottom: 18, color: "var(--charcoal)" }}>
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Share CTA */}
      <div className="container" style={{ paddingTop: 8, paddingBottom: 8 }}>
        <div
          className="lcard"
          style={{ padding: "20px 22px", borderLeft: "3px solid var(--teal)" }}
        >
          <div className="lbl lbl-teal" style={{ marginBottom: 6 }}>
            Your turn
          </div>
          <p className="t-body" style={{ marginBottom: 12 }}>
            Every spotlight started as a first week. Tell the community what you
            practiced, what broke, and what changed.
          </p>
          <Link className="btn btn-red" href="/stories">
            Share your story
          </Link>
        </div>
      </div>

      {/* More spotlights */}
      {more.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  More spotlights
                </div>
                <h2 className="t-h3">Others building in the open</h2>
              </div>
              <Link className="see" href="/stories">
                All spotlights →
              </Link>
            </div>
            <div className="story-row">
              {more.map((x) => (
                <Link
                  key={x.id}
                  className="card tappable story-card"
                  href={`/stories/${x.slug}`}
                >
                  <div
                    className={x.image_url ? "story-media" : `story-media ${x.grad || "m-teal"}`}
                    aria-hidden="true"
                  >
                    {x.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imgSrc(x.image_url)}
                        alt=""
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "center 20%",
                        }}
                      />
                    ) : (
                      <Orb />
                    )}
                  </div>
                  <div className="card-body">
                    {x.quote && <p className="t-body story-quote">&ldquo;{x.quote}&rdquo;</p>}
                    <div className="t-h4" style={{ marginTop: "auto" }}>
                      {x.name}
                    </div>
                    {x.role && (
                      <div className="lbl" style={{ marginTop: 4 }}>
                        {x.role}
                      </div>
                    )}
                    <span className="see" style={{ display: "inline-block", marginTop: 12 }}>
                      Read more →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
