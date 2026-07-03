import Link from "next/link";
import PublicNav from "@/app/components/chrome/public-nav";
import OrbDefs from "@/app/components/chrome/orb-defs";
import Orb from "@/app/components/chrome/orb";
import { OsFooter } from "@/app/components/chrome/site-footers";
import MetroSearch from "@/app/components/content/metro-search";
import {
  EventTeaser,
  ResourceTeaser,
  LabTeaser,
} from "@/app/components/content/teasers";
import { getEvents, getResources, getMetros } from "@/lib/content/queries";
import { publicSession } from "@/lib/auth/public-session";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata = {
  title: "The Upskilling Labs",
  description: "Find your people. Build your edge.",
};

// Auth-aware nav + live content tables — always rendered per request.
export const dynamic = "force-dynamic";

/* The public landing — onboarding-proto's view-landing: dark hero over
   photography, then browse-free sections (cycles · workshops · library ·
   labs) rendered from the content tables, ending in the open-source footer.
   The stories row and the survey CTA arrive with their stages. */
export default async function LandingPage() {
  const [{ signedIn, initials }, events, resources, metros] =
    await Promise.all([publicSession(), getEvents(), getResources(), getMetros()]);

  // The cycle banner's CTA: signed-in members go straight to the ceremony.
  let activeCycleId: number | null = null;
  try {
    const supabase = createServiceClient();
    const { data: cycle } = await supabase
      .from("cycles")
      .select("id")
      .eq("status", "active")
      .maybeSingle();
    activeCycleId = cycle?.id ?? null;
  } catch {
    activeCycleId = null;
  }
  const joinCycleHref =
    signedIn && activeCycleId ? `/cycles/${activeCycleId}/join` : "/login";

  const now = new Date();
  const upcoming = events.filter((e) => new Date(e.start_at) >= now);
  const landingEvents = (upcoming.length >= 6 ? upcoming : events).slice(0, 6);
  const landingResources = resources.slice(0, 6);
  const landingLabs = metros.slice(0, 4);

  return (
    <div className="flex min-h-screen flex-col">
      <OrbDefs />
      <PublicNav signedIn={signedIn} initials={initials} overHero />

      {/* ── Hero ── */}
      <div className="hero-band s-cover grain on-dark">
        <div className="hero-scrim" aria-hidden="true" />
        <div className="hero-photo" aria-hidden="true" />
        <div className="hero-tint" aria-hidden="true" />
        <div className="hero-inner">
          <h1 className="t-display">
            Find your people.
            <br />
            Build your edge.
          </h1>
          <div className="hero-cta">
            <p className="t-lede" style={{ marginBottom: 24 }}>
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
        </div>
      </div>

      {/* ── Cycles ── */}
      <section className="section s-white sec-after-hero" id="sec-cycles">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                Build Cycles · 4 a year
              </div>
              <h2 className="t-h2">Join a cohort, ship something real</h2>
            </div>
            <Link className="see" href="/build-cycles">
              How cycles work →
            </Link>
          </div>
          <div className="cycle-banner s-cover grain on-dark">
            <Orb />
            <div className="cb-body">
              <span className="cb-status">Registration Open Now</span>
              <div className="lbl lbl-teal" style={{ margin: "14px 0 6px" }}>
                Summer 2026 · Washington, DC
              </div>
              <h3 className="t-h2">Civic &amp; Elections Cycle</h3>
              <p className="t-body" style={{ marginTop: 8, maxWidth: "52ch" }}>
                Kicks off July 14, 2026 · a 13-week cohort shipping a real
                civic project.
              </p>
              <p className="t-small" style={{ marginTop: 6, color: "var(--od2)", maxWidth: "52ch" }}>
                An Open Cycle — the projects are open source, free for anyone
                to use and build on.
              </p>
            </div>
            <div className="cb-cta">
              <Link className="btn btn-red btn-lg" href={joinCycleHref}>
                Join this cycle
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Workshops ── */}
      <section className="section s-white" id="sec-workshops">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                Workshops &amp; sessions · weekly
              </div>
              <h2 className="t-h2">Drop into a session</h2>
            </div>
            <Link className="see" href="/events">
              All events →
            </Link>
          </div>
          <div className="cards dense">
            {landingEvents.map((e) => (
              <EventTeaser key={e.slug} event={e} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Learning Library ── */}
      <section className="section s-white" id="sec-library">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                Learning Library · on-demand
              </div>
              <h2 className="t-h2">Learn at your own pace</h2>
            </div>
            <Link className="see" href="/library">
              Full library →
            </Link>
          </div>
          <div className="cards dense">
            {landingResources.map((r) => (
              <ResourceTeaser key={r.slug} resource={r} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Local labs ── */}
      <section className="section s-white" id="sec-labs">
        <div className="container">
          <div className="section-head">
            <div>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                Local labs
              </div>
              <h2 className="t-h2">Find your city</h2>
            </div>
            <Link className="see" href="/labs">
              All cities →
            </Link>
          </div>
          <div className="cards">
            {landingLabs.map((m) => (
              <LabTeaser key={m.slug} metro={m} />
            ))}
          </div>
          <MetroSearch metros={metros} />
        </div>
      </section>

      <OsFooter />
    </div>
  );
}
