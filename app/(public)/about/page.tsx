import Link from "next/link";

/* The public About page — composed on the editorial "standards-manual" grid
   (ref: 1976 NASA Graphics Standards Manual, Column Five, The Futur) as a stack
   of ROWS: each section's eyebrow + heading share the head row; body, lists,
   cards and pulled quotes flow in the rows beneath, in equal same-hierarchy
   columns. Copy is from the generator (the design source of truth). */

// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "About · The Upskilling Labs",
  description:
    "We believe people are capable of far more than they’ve been given the opportunity to prove. That’s why The Upskilling Labs exists.",
};

const BELIEFS = [
  "People are more capable than they realize.",
  "Capability grows through practice.",
  "Confidence is earned through experience.",
  "Better questions matter more than faster answers.",
  "Communities become stronger when more people can contribute meaningfully.",
  "Learning never really ends.",
];

const BUILT: [string, string][] = [
  ["Build Cycles", "Three months, a real problem, a small team that ships."],
  ["Pods", "A handful of people who dig into a problem together."],
  ["Workshops", "Hands-on sessions led by practitioners, open to everyone."],
  ["Mentors", "People who’ve done the work, around when you’re stuck."],
  ["Community", "Library-hosted, in person, in the open."],
  ["AI", "A tool we use everywhere. Never the destination."],
];

const HAPPENS = [
  "Investigate a real problem",
  "Interview the people living it",
  "Prototype an idea",
  "Work alongside people outside your field",
  "Experiment with emerging technology",
  "Present your work publicly",
  "Discover strengths you didn’t know you had",
];

const MINDSET = [
  "curious",
  "generous",
  "intellectually humble",
  "willing to experiment",
  "excited by difficult problems",
  "comfortable learning in public",
];

// The section eyebrow — sits in column 1, baseline-aligned to the heading.
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="ed-eyebrow">
      <div className="lbl lbl-teal">{children}</div>
    </div>
  );
}

// A numbered/ruled section: eyebrow + heading on the head row; the caller
// supplies the content rows (`.ed-cols` …) that flow beneath.
function Sec({
  label,
  heading,
  children,
}: {
  label: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ed-sec">
      <hr className="ed-rule" />
      <Eyebrow>{label}</Eyebrow>
      <h2 className="ed-heading t-h2">{heading}</h2>
      {children}
    </section>
  );
}

// A quote pulled to its own row (never beside the heading).
function Pull({ children }: { children: React.ReactNode }) {
  return (
    <div className="ed-cols">
      <p className="ed-pull">{children}</p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <>
      {/* ── Header: eyebrow + headline (head row), standfirst (row beneath) ── */}
      <section className="grain on-dark" style={{ background: "var(--ink)" }}>
        <div className="container" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <div className="ed-sec">
            <Eyebrow>About</Eyebrow>
            <h1 className="ed-heading t-h1">
              We believe people are capable of far more than they’ve been given
              the opportunity to prove.
            </h1>
            <div className="ed-cols">
              <div>
                <p className="t-lede ed-text" style={{ color: "var(--od2)" }}>
                  The world has changed. Knowledge is everywhere. AI is
                  transforming how work gets done. Careers are becoming less
                  predictable, more interdisciplinary, and more self-directed.
                </p>
                <p className="t-lede ed-text" style={{ marginTop: 16, color: "var(--od2)" }}>
                  The challenge isn’t keeping up with information. It’s becoming
                  the kind of person who can make sense of change — and help shape
                  what comes next.
                </p>
                <p
                  className="t-lede ed-text"
                  style={{ marginTop: 16, color: "var(--od1)", fontWeight: 600 }}
                >
                  That’s why The Upskilling Labs exists.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="container" style={{ paddingTop: 88, paddingBottom: 56 }}>
        <div className="ed-doc">
          <Sec label="Our perspective" heading="The way we learn hasn’t kept pace with the world.">
            <div className="ed-cols">
              <div>
                <p className="t-lede ed-text" style={{ marginBottom: 16 }}>
                  Knowledge used to be the hard part. Now it’s everywhere, and AI is
                  putting expertise within anyone’s reach. The skills that matter
                  change faster every year.
                </p>
                <p className="t-body ed-text">
                  What work rewards now is different: curiosity, judgment,
                  collaboration, and the ability to adapt. The future belongs to
                  people who keep growing what they’re capable of.
                </p>
              </div>
            </div>
            <Pull>We don’t think the answer is more information. We think it’s learning that becomes capability.</Pull>
          </Sec>

          <Sec label="What we believe" heading="Capability changes everything.">
            <div className="ed-cols">
              <p className="t-lede ed-text">Principles, not programs:</p>
            </div>
            <div className="ed-cols ed-cols-2">
              {BELIEFS.map((b) => (
                <p className="t-body" key={b}>
                  {b}
                </p>
              ))}
            </div>
          </Sec>

          <Sec label="What we built" heading="So we built a different kind of place.">
            <div className="ed-cols">
              <p className="t-lede ed-text">
                The Upskilling Labs is a community built around a simple idea:
                learning sticks when you use it. You learn, you practice, you build
                — together. Born at DC Public Library in fall 2025, run in the open
                ever since.
              </p>
            </div>
            <div className="ed-cols ed-cols-2">
              {BUILT.map(([t, b]) => (
                <div key={t}>
                  <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                    {t}
                  </div>
                  <p className="t-body" style={{ color: "var(--slate)" }}>
                    {b}
                  </p>
                </div>
              ))}
            </div>
          </Sec>

          <Sec label="What happens here" heading="Transformation happens through practice.">
            <div className="ed-cols">
              <p className="t-lede ed-text">You might…</p>
            </div>
            <div className="ed-cols ed-cols-2">
              {HAPPENS.map((b) => (
                <p className="t-body" key={b}>
                  {b}
                </p>
              ))}
            </div>
            <Pull>You leave more capable than you arrived.</Pull>
          </Sec>

          <Sec label="Who belongs here" heading="You don’t need to have it all figured out.">
            <div className="ed-cols">
              <div>
                <p className="t-lede ed-text" style={{ marginBottom: 20 }}>
                  Not credentials. Not a profession. A mindset. The people who thrive
                  here are…
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                  {MINDSET.map((t) => (
                    <span className="chip" style={{ cursor: "default" }} key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                <p className="t-body ed-text" style={{ fontWeight: 600 }}>
                  If you’re willing to grow, you belong here.
                </p>
              </div>
            </div>
          </Sec>

          <Sec label="Looking forward" heading="We’re building for a future none of us can predict.">
            <div className="ed-cols">
              <div>
                <p className="t-lede ed-text" style={{ marginBottom: 16 }}>
                  The Labs isn’t preparing you for one job or one technology. It’s how
                  you build the capacity to navigate change — this year’s, and every
                  year after.
                </p>
                <p className="t-body ed-text">
                  That’s the mission. Not preparing people for the future. Helping
                  people become the kind of people who can help create it.
                </p>
              </div>
            </div>
          </Sec>

          <Sec label="Join" heading="This is just the beginning.">
            <div className="ed-cols">
              <div>
                <p className="t-lede ed-text" style={{ marginBottom: 24 }}>
                  Whether you’re looking to challenge yourself, contribute to
                  something meaningful, meet extraordinary people, or simply become
                  more capable than you were yesterday, there’s a place for you here.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
                  <Link className="btn btn-red btn-lg" href="/build-cycles">
                    Explore how The Labs works
                  </Link>
                  <Link className="see" href="/login?intent=join">
                    Ready now? Join The Labs →
                  </Link>
                </div>
              </div>
            </div>
          </Sec>
        </div>
      </div>
    </>
  );
}
