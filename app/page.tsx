import Link from "next/link";
import PublicNav from "@/app/components/chrome/public-nav";
import HeroFade from "@/app/components/chrome/hero-fade";
import OrbDefs from "@/app/components/chrome/orb-defs";
import Orb from "@/app/components/chrome/orb";
import { OsFooter } from "@/app/components/chrome/site-footers";
import HomeSpotlights from "@/app/components/content/home-spotlights";
import {
  EventTeaser,
  ResourceTeaser,
  LabTeaser,
} from "@/app/components/content/teasers";
import { getEvents, getResources, getMetros } from "@/lib/content/queries";
import { publicSession } from "@/lib/auth/public-session";
import { createServiceClient } from "@/lib/supabase/server";
import { getRecruitingCycle } from "@/lib/cycle/active";
import { getPublishedSpotlights } from "@/lib/content/spotlights";

export const metadata = {
  title: "The Upskilling Labs — local communities of practice for lifelong upskilling",
  description:
    "The Upskilling Labs is a network of local communities of practice where people learn by doing and keep leveling up for life. OLOS is the platform that runs them — sign in to join your local lab, form a cohort, and build something real.",
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

// The three strands of the workshop curriculum, shown under the events row.
const WHAT_YOU_LEARN: [string, string][] = [
  [
    "Durable skills",
    "The human skills the future of work runs on—communication, storytelling, problem framing, rapid iteration. AI means anyone can build; these are how you find the problems worth solving.",
  ],
  [
    "AI skills",
    "The technical side of working with AI—prompt engineering, vibe coding, working with agents, and more. Hands-on practice with the tools that are reshaping how work gets done, so you can build alongside them instead of being left behind.",
  ],
  [
    "Supports the cycle",
    "Workshops track the Build Cycle, so each session gives you what your pod needs next—from framing a problem, to prototyping, to telling the story of what you built.",
  ],
];

// The story arc under "Find your city" — where the Labs came from, how they
// scale, and where they're headed.
const OUR_STORY: [string, string][] = [
  [
    "Founded in DC",
    "The Upskilling Labs started as a pilot in Washington, DC at the DC Public Library in fall of 2025—a small group of ex-feds proving that people navigating career change and new technologies learn faster together. Now, DC is home to our first chapter and our mission has expanded to all professionals.",
  ],
  [
    "Built to scale",
    "We run our own Build Cycle process on ourselves, turning what works into an operating system and playbooks—so a new lab can stand up anywhere without reinventing how it works. Every cycle makes it better, and we’re building it all for the community, open-source.",
  ],
  [
    "Expanding nationally",
    "We’re just getting started—and the impacts of AI are far from local. From DC, we’re heading to cities across the country. We aim to build a more resilient future of work for all of us by bringing the Labs to wherever people are ready to learn by doing alongside their neighbors.",
  ],
];

// The three-month arc shown under the cycle banner. Copy moves to the
// `cycles` table if months ever become data-driven.
const CYCLE_ANATOMY: [string, string, string][] = [
  [
    "Month 1",
    "Problem Discovery",
    "You’ll explore challenges that matter to you and to an entire industry, from real-world surveys to AI-assisted research. Through community voting, the most compelling problems rise to the top—and small teams called “pods” form around them.",
  ],
  [
    "Month 2",
    "Experimentation",
    "As your pod explores your problem spaces, you come up with projects—proposed solutions to the challenges you’ve deeply understood. You’ll research, prototype, and test ideas: learning AI by doing, supported by peers and mentors along the way.",
  ],
  [
    "Month 3",
    "Synthesis",
    "Projects turn experiments into working prototypes—tools, workflows, templates. Every cycle ends with a public showcase, so your work has visibility and impact beyond the twelve weeks. Projects can keep going at the end of the cycle as open-source efforts in the Labs.",
  ],
];

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
              <p className="t-lede" style={{ marginBottom: 24, maxWidth: "54ch" }}>
                AI is rewriting how we work, and it&rsquo;s easier to learn
                together than alone. So we help you find people near you to learn
                with, build something real with AI, and grow more confident
                together. Sign in with Google to jump in.
              </p>
              {signedIn ? (
                <Link className="btn btn-teal btn-lg" href="/dashboard">
                  Go to your dashboard
                </Link>
              ) : (
                <>
                  <Link className="btn btn-red btn-lg" href="/login?intent=join">
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
      {spotlights.length > 0 && <HomeSpotlights spotlights={spotlights} />}

      {/* ── Cycles ── */}
      <section
        className={`section s-white${spotlights.length > 0 ? "" : " sec-after-hero"}`}
        id="sec-cycles"
      >
        <div className="container">
          <SectionHead
            eyebrow="Build Cycles · 4 per year"
            heading="Join a Build Cycle, solve a real problem"
          />
          {recruitingCycle ? (
            <div className="cycle-banner s-cover grain on-dark">
              <Orb />
              <div className="cb-body">
                <span className="cb-status">
                  {recruitingCycle.status === "upcoming"
                    ? "Registration open now"
                    : "Cycle in progress"}
                </span>
                {bannerSeason && (
                  <div className="lbl lbl-teal" style={{ margin: "14px 0 6px" }}>
                    {bannerSeason}
                  </div>
                )}
                <h3 className="t-h2">{recruitingCycle.name}</h3>
                {bannerKickoff && (
                  <p className="t-body" style={{ marginTop: 8, maxWidth: "52ch" }}>
                    Kicks off {bannerKickoff} — twelve weeks, a group of curious
                    peers learning AI by tackling problems worth caring about
                    with solutions worth building.
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

          {/* Anatomy of a Build Cycle — the three-month arc */}
          <div style={{ marginTop: 48 }}>
            <div className="lbl lbl-teal" style={{ marginBottom: 20 }}>
              Anatomy of a Build Cycle
            </div>
            <div
              style={{
                display: "grid",
                gap: 32,
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                alignItems: "start",
              }}
            >
              {CYCLE_ANATOMY.map(([month, title, body]) => (
                <div key={month}>
                  <div className="lbl" style={{ marginBottom: 8 }}>
                    {month}
                  </div>
                  <h3 className="t-h3" style={{ marginBottom: 8 }}>
                    {title}
                  </h3>
                  <p className="t-body" style={{ maxWidth: "44ch" }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
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

          {/* What you learn — the three strands of the curriculum */}
          <div style={{ marginTop: 48 }}>
            <div className="lbl lbl-teal" style={{ marginBottom: 20 }}>
              What you learn
            </div>
            <div
              style={{
                display: "grid",
                gap: 32,
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                alignItems: "start",
              }}
            >
              {WHAT_YOU_LEARN.map(([title, body]) => (
                <div key={title}>
                  <h3 className="t-h3" style={{ marginBottom: 8 }}>
                    {title}
                  </h3>
                  <p className="t-body" style={{ maxWidth: "44ch" }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Learning Library ── */}
      <section className="section s-white" id="sec-library">
        <div className="container">
          <SectionHead
            eyebrow="Learning Library · on-demand"
            heading="Learn at your own pace"
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
          />
          {/* Just the lab cards — the search bar waits until there are more
              than two cities (it lives on /local-labs). */}
          <div className="cards">
            {landingLabs.map((m) => (
              <LabTeaser key={m.slug} metro={m} />
            ))}
          </div>

          {/* Our story — founded in DC, built to scale, expanding nationally */}
          <div style={{ marginTop: 48 }}>
            <div className="lbl lbl-teal" style={{ marginBottom: 20 }}>
              Our story
            </div>
            <div
              style={{
                display: "grid",
                gap: 32,
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                alignItems: "start",
              }}
            >
              {OUR_STORY.map(([title, body]) => (
                <div key={title}>
                  <h3 className="t-h3" style={{ marginBottom: 8 }}>
                    {title}
                  </h3>
                  <p className="t-body" style={{ maxWidth: "44ch" }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── What this is ── A plain-language description of the platform and
          why we ask you to sign in with Google. Kept as the last section above
          the footer so anyone — and Google's OAuth reviewers — can see the
          app's purpose and its data use without logging in. */}
      <section className="section s-white" id="sec-about">
        <div className="container">
          <SectionHead
            eyebrow="What this is"
            heading="A new way to learn, together"
          />
          <div
            style={{
              display: "grid",
              gap: 32,
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              alignItems: "start",
            }}
          >
            <div>
              <p className="t-body" style={{ marginBottom: 16, maxWidth: "60ch" }}>
                Unlike traditional courses with fixed enrollment and passive
                instruction, Open Labs are peer-powered and project-based. You
                don&rsquo;t need a technical background to get
                started&mdash;just a willingness to learn by doing alongside
                others.
              </p>
              <p className="t-body" style={{ marginBottom: 16, maxWidth: "60ch" }}>
                Inside an Open Lab, you&rsquo;ll find weekly workshops and
                quarterly Build Cycles. Workshops support you in building the
                skills you need to master the future of work: from durable
                skills like problem framing to AI-specific skills like
                prompt-engineering.
              </p>
              <p className="t-body" style={{ maxWidth: "60ch" }}>
                Build Cycles are a twelve-week program where you go from deeply
                exploring a problem space, to forming a pod with peers, to
                rapidly prototyping solutions. Each month is anchored by a
                meetup where you present your progress, culminating in a demo at
                our Summit. And everything you create is open-source by default
                so others can learn from and build on your work.
              </p>
            </div>
            <div className="lcard" style={{ padding: 28 }}>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                Signing in
              </div>
              <h3 className="t-h3" style={{ marginBottom: 10 }}>
                Why we ask for your Google account
              </h3>
              <p className="t-body" style={{ marginBottom: 14 }}>
                You create your member account by signing in with Google. We use
                only your name, email address, and profile picture — to set up
                your profile and keep you signed in. We never request access to
                your Gmail, Drive, or Calendar.
              </p>
              <Link className="see" href="/privacy">
                How we handle your data →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <OsFooter />
    </div>
  );
}
