import Link from "next/link";
import PublicNav from "@/app/components/chrome/public-nav";
import HeroFade from "@/app/components/chrome/hero-fade";
import OrbDefs from "@/app/components/chrome/orb-defs";
import Orb from "@/app/components/chrome/orb";
import { OsFooter } from "@/app/components/chrome/site-footers";
import MetroSearch from "@/app/components/content/metro-search";
import {
  EventTeaser,
  ResourceTeaser,
} from "@/app/components/content/teasers";
import { getEvents, getResources, getMetros } from "@/lib/content/queries";
import { publicSession } from "@/lib/auth/public-session";
import { createServiceClient } from "@/lib/supabase/server";
import { getRecruitingCycle } from "@/lib/cycle/active";
import { getPublishedSpotlights } from "@/lib/content/spotlights";

export const metadata = {
  title: "The Upskilling Labs",
  description: "Find your people. Build your edge.",
};

// Auth-aware nav + live content tables — always rendered per request.
export const dynamic = "force-dynamic";

// "Summer 2026" from a start date — the banner's season label (no location
// column exists yet; the local lab is surfaced separately).
function seasonYear(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const seasons = ["Winter", "Spring", "Summer", "Fall"];
  return `${seasons[Math.floor(((d.getMonth() + 1) % 12) / 3)]} ${d.getFullYear()}`;
}

/* A landing section head: the eyebrow + heading stacked at the left edge, so
   they line up with the full-width card grid / banner that follows, and the
   section's "see →" link trailing at the right. `.section-head` carries the
   heavy rule and the flex layout — the editorial column grid is for the content
   pages, not these browse sections whose content runs full-width. */
function SectionHead({
  eyebrow,
  heading,
  seeHref,
  seeLabel,
}: {
  eyebrow: string;
  heading: string;
  seeHref?: string;
  seeLabel?: string;
}) {
  return (
    <div className="section-head">
      <div>
        <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
          {eyebrow}
        </div>
        <h2 className="t-h2">{heading}</h2>
      </div>
      {seeHref && seeLabel && (
        <Link className="see" href={seeHref}>
          {seeLabel}
        </Link>
      )}
    </div>
  );
}

/* The public landing — onboarding-proto's view-landing: dark hero over
   photography, then browse-free sections (cycles · workshops · library ·
   labs) rendered from the content tables, ending in the open-source footer.
   The stories row and the survey CTA arrive with their stages. */
export default async function LandingPage() {
  const [{ signedIn, initials, avatarUrl }, events, resources, metros, recruitingCycle, spotlights] =
    await Promise.all([
      publicSession(),
      getEvents(),
      getResources(),
      getMetros(),
      getRecruitingCycle(createServiceClient()).catch(() => null),
      getPublishedSpotlights(),
    ]);

  // The registration banner is driven by the recruiting cycle (the upcoming
  // cohort if one is open, else the running one). Signed-in members go straight
  // to the join ceremony; signed-out visitors enter the funnel at /login. A
  // signed-in member with no open cycle lands on their dashboard — never
  // bounced back to /login (the old fail-open).
  const joinCycleHref = recruitingCycle
    ? signedIn
      ? `/cycles/${recruitingCycle.id}/join`
      : "/login"
    : signedIn
      ? "/dashboard"
      : "/login";
  const bannerSeason = seasonYear(recruitingCycle?.start_date ?? null);
  const bannerKickoff = recruitingCycle?.start_date
    ? new Date(recruitingCycle.start_date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // The events preview shows the six soonest upcoming events, in order
  // (getEvents() is start_at ASC, so `upcoming` is already soonest-first). If
  // there aren't six upcoming yet, top up with the most recent past ones so the
  // row never looks empty. The rest wait behind "All events →".
  const LANDING_EVENT_CAP = 6;
  const now = new Date();
  const upcoming = events.filter(
    (e) => new Date(e.end_at ?? e.start_at) >= now
  );
  const landingEvents = upcoming.slice(0, LANDING_EVENT_CAP);
  if (landingEvents.length < LANDING_EVENT_CAP) {
    const recentPast = events
      .filter((e) => new Date(e.end_at ?? e.start_at) < now)
      .reverse(); // ASC in → newest first
    landingEvents.push(
      ...recentPast.slice(0, LANDING_EVENT_CAP - landingEvents.length)
    );
  }
  const landingResources = resources.slice(0, 6);
  const landingLabs = metros.slice(0, 4);

  return (
    <div className="flex min-h-screen flex-col">
      <OrbDefs />

      {/* ── Hero ── The nav + hero share one shell so the nav stays sticky only
          while the hero is on screen, then scrolls away with it. */}
      <div className="hero-shell">
        <PublicNav signedIn={signedIn} initials={initials} avatarUrl={avatarUrl} overHero />
        <div className="hero-band s-cover grain on-dark">
          <div className="hero-scrim" aria-hidden="true" />
          <div className="hero-photo" aria-hidden="true" />
          <div className="hero-tint" aria-hidden="true" />
          <HeroFade>
            <h1 className="t-display">
              Find your people.
              <br />
              Build your edge.
            </h1>
            <div className="hero-cta">
              <p className="t-lede" style={{ marginBottom: 24, maxWidth: "52ch" }}>
                The Labs isn’t a class you sit through. It’s where you practice
                becoming the person you want to be — on real problems, with
                people who notice.
              </p>
              {signedIn ? (
                <Link className="btn btn-teal btn-lg" href="/dashboard">
                  Go to your dashboard
                </Link>
              ) : (
                <>
                  <Link className="btn btn-red btn-lg" href="/login">
                    Join The Labs
                  </Link>
                  <Link className="btn btn-ghost btn-lg hero-login" href="/login">
                    Log in
                  </Link>
                </>
              )}
            </div>
          </HeroFade>
        </div>
      </div>

      {/* ── Upskiller Spotlights (onboarding-proto #sec-stories) ── */}
      {spotlights.length > 0 && (
        <section className="section s-white sec-after-hero" id="sec-stories">
          <div className="story-bleed">
            <div className="story-row">
              {spotlights.slice(0, 6).map((s) => (
                <Link
                  key={s.id}
                  className="card tappable story-card"
                  href={`/stories/${s.slug}`}
                >
                  <div
                    className={s.image_url ? "story-media" : `story-media ${s.grad || "m-teal"}`}
                    aria-hidden="true"
                  >
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={/^https?:\/\//.test(s.image_url) ? s.image_url : `/${s.image_url.replace(/^\//, "")}`}
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
                    <p className="t-body story-quote">&ldquo;{s.quote}&rdquo;</p>
                    <div className="t-h4" style={{ marginTop: "auto" }}>
                      {s.name}
                    </div>
                    {s.role && (
                      <div className="lbl" style={{ marginTop: 4 }}>
                        {s.role}
                      </div>
                    )}
                    <span className="see" style={{ display: "inline-block", marginTop: 12 }}>
                      Read more →
                    </span>
                  </div>
                </Link>
              ))}
              <Link className="card tappable story-cta" href="/stories">
                <div
                  className="card-body"
                  style={{ display: "flex", flexDirection: "column", height: "100%" }}
                >
                  <div className="lbl lbl-teal" style={{ marginBottom: 10 }}>
                    Your turn
                  </div>
                  <div className="t-h3" style={{ marginBottom: 10 }}>
                    Share your story or read more
                  </div>
                  <p className="t-body" style={{ marginBottom: 18 }}>
                    Spotlights are public — read more from the community, or add your own.
                  </p>
                  <span className="see" style={{ marginTop: "auto" }}>
                    Upskilling Stories →
                  </span>
                </div>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Cycles ── */}
      <section
        className={`section s-white${spotlights.length > 0 ? "" : " sec-after-hero"}`}
        id="sec-cycles"
      >
        <div className="container">
          <SectionHead
            eyebrow="Build Cycles · 4 a year"
            heading="Join a cohort, ship something real"
            seeHref="/build-cycles"
            seeLabel="How cycles work →"
          />
          {recruitingCycle ? (
            <div className="cycle-banner s-cover grain on-dark">
              <Orb />
              <div className="cb-body">
                <span className="cb-status">
                  {recruitingCycle.status === "upcoming"
                    ? "Registration open now"
                    : "Cohort in progress"}
                </span>
                {bannerSeason && (
                  <div className="lbl lbl-teal" style={{ margin: "14px 0 6px" }}>
                    {bannerSeason}
                  </div>
                )}
                <h3 className="t-h2">{recruitingCycle.name}</h3>
                {bannerKickoff && (
                  <p className="t-body" style={{ marginTop: 8, maxWidth: "52ch" }}>
                    Kicks off {bannerKickoff} — twelve weeks, one real project,
                    with people who notice.
                  </p>
                )}
                {recruitingCycle.mode === "open" && (
                  <p className="t-small" style={{ marginTop: 6, color: "var(--od2)", maxWidth: "52ch" }}>
                    An Open Cycle — the projects are open source, free for anyone
                    to use and build on.
                  </p>
                )}
              </div>
              <div className="cb-cta">
                <Link className="btn btn-red btn-lg" href={joinCycleHref}>
                  {signedIn ? "Join this cycle" : "Join The Labs"}
                </Link>
              </div>
            </div>
          ) : (
            <div className="cycle-banner s-cover grain on-dark">
              <Orb />
              <div className="cb-body">
                <span className="cb-status">Next cycle coming soon</span>
                <h3 className="t-h2" style={{ marginTop: 14 }}>
                  No cycle is open right now
                </h3>
                <p className="t-body" style={{ marginTop: 8, maxWidth: "52ch" }}>
                  The next Build Cycle is still being planned. Join The Labs and
                  we&apos;ll tell you the moment registration opens.
                </p>
              </div>
              <div className="cb-cta">
                <Link className="btn btn-red btn-lg" href={joinCycleHref}>
                  {signedIn ? "Go to your dashboard" : "Join The Labs"}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Workshops ── */}
      <section className="section s-white" id="sec-workshops">
        <div className="container">
          <SectionHead
            eyebrow="Workshops & sessions · weekly"
            heading="Drop into a session"
            seeHref="/events"
            seeLabel="All events →"
          />
          <div className="cards dense fit">
            {landingEvents.map((e) => (
              <EventTeaser key={e.slug} event={e} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Learning Library ── */}
      <section className="section s-white" id="sec-library">
        <div className="container">
          <SectionHead
            eyebrow="Learning Library · on-demand"
            heading="Learn at your own pace"
            seeHref={landingResources.length > 0 ? "/library" : undefined}
            seeLabel={landingResources.length > 0 ? "Full library →" : undefined}
          />
          {landingResources.length ? (
            <div className="cards dense">
              {landingResources.map((r) => (
                <ResourceTeaser key={r.slug} resource={r} />
              ))}
            </div>
          ) : (
            <div className="lcard" style={{ padding: 48 }}>
              <div className="t-h3">Coming Soon</div>
            </div>
          )}
        </div>
      </section>

      {/* ── Local labs ── */}
      <section className="section s-white" id="sec-labs">
        <div className="container">
          <SectionHead
            eyebrow="Local labs"
            heading="Find your city"
            seeHref="/local-labs"
            seeLabel="All cities →"
          />
          <MetroSearch metros={metros} initial={landingLabs} signedIn={signedIn} />
        </div>
      </section>

      <OsFooter />
    </div>
  );
}
