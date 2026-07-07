import Link from "next/link";
import { Crumbs } from "@/app/components/content/teasers";

/* The public About page — recomposed on the editorial "standards-manual" grid
   (ref: 1976 NASA Graphics Standards Manual, Column Five, The Futur): a document
   bar, a balanced header, then numbered sections with a red index, a heavy rule,
   the content column and a right rail. Copy is from the generator (the design
   source of truth). */

// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "About · The Upskilling Labs",
  description:
    "We believe people are capable of far more than they’ve been given the opportunity to prove. That’s why The Upskilling Labs exists.",
};

const TRAIL: [string, string | null][] = [
  ["Home", "/"],
  ["About", null],
];

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
  "investigate a real problem",
  "interview the people living it",
  "prototype an idea",
  "work alongside people outside your field",
  "experiment with emerging technology",
  "present your work publicly",
  "discover strengths you didn’t know you had",
];

const MINDSET = [
  "curious",
  "generous",
  "intellectually humble",
  "willing to experiment",
  "excited by difficult problems",
  "comfortable learning in public",
];

// A numbered "standards-manual" section (ref: 1976 NASA Graphics Standards
// Manual): a red index number over its label in the left column, heading + body
// in the content column, an optional pulled quote in the right rail, all divided
// by a heavy rule. See .ed-* in globals.css.
function Sec({
  num,
  label,
  heading,
  children,
  aside,
}: {
  // A numeral only where a real sequence exists (steps, phases) — never on plain
  // content sections, where it would imply an order that isn't there.
  num?: string;
  label: string;
  heading?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section>
      <hr className="ed-rule" />
      <div className="ed-grid">
        <div className="ed-index">
          {num && <span className="ed-num">{num}</span>}
          <div className="lbl lbl-teal">{label}</div>
        </div>
        <div className="ed-main">
          {heading && (
            <h2 className="t-h2" style={{ marginBottom: 18 }}>
              {heading}
            </h2>
          )}
          {children}
        </div>
        {aside && <div className="ed-aside">{aside}</div>}
      </div>
    </section>
  );
}

// A quote pulled into the right rail — a teal rule over the line.
function RailQuote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 20,
        fontWeight: 600,
        lineHeight: "27px",
        letterSpacing: "-.02em",
        borderTop: "2px solid var(--teal)",
        paddingTop: 14,
      }}
    >
      {children}
    </p>
  );
}

export default function AboutPage() {
  return (
    <>
      {/* Document bar — identifier left, section ref right, rule under */}
      <div className="container" style={{ paddingTop: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 16,
            paddingBottom: 12,
          }}
        >
          <Crumbs trail={TRAIL} />
          <span className="lbl">The Upskilling Labs · About</span>
        </div>
        <hr className="ed-rule" style={{ marginBottom: 0 }} />
      </div>

      {/* ── Editorial header ── */}
      <section className="grain on-dark" style={{ background: "var(--ink)" }}>
        <div className="container" style={{ paddingTop: 88, paddingBottom: 88 }}>
          <div className="ed-grid">
            <div className="ed-index">
              <div className="lbl lbl-teal">About</div>
            </div>
            <div className="ed-main">
              <h1 className="t-h1">
                We believe people are capable of far more than they’ve been given
                the opportunity to prove.
              </h1>
            </div>
            <div className="ed-aside ed-drop">
              <p className="t-lede" style={{ color: "var(--od2)" }}>
                The world has changed. Knowledge is everywhere. AI is transforming
                how work gets done. Careers are becoming less predictable, more
                interdisciplinary, and more self-directed.
              </p>
              <p className="t-lede" style={{ marginTop: 14, color: "var(--od2)" }}>
                The challenge isn’t keeping up with information. It’s becoming the
                kind of person who can make sense of change.
              </p>
              <p
                className="t-lede"
                style={{ marginTop: 14, color: "var(--od1)", fontWeight: 600 }}
              >
                That’s why The Upskilling Labs exists.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="container" style={{ paddingTop: 88, paddingBottom: 56 }}>
        <div className="ed-doc">
          <Sec
            label="Our perspective"
            heading="The way we learn hasn’t kept pace with the world."
            aside={<RailQuote>Learning that becomes capability.</RailQuote>}
          >
            <p className="t-lede ed-text" style={{ marginBottom: 16 }}>
              Knowledge used to be the hard part. Now it’s everywhere, and AI is
              putting expertise within anyone’s reach. The skills that matter change
              faster every year.
            </p>
            <p className="t-body ed-text">
              What work rewards now is different: curiosity, judgment, collaboration,
              and the ability to adapt. The future belongs to people who keep growing
              what they’re capable of.
            </p>
          </Sec>

          <Sec
            label="What we believe"
            heading="Capability changes everything."
          >
            <p className="t-lede ed-text" style={{ marginBottom: 20 }}>
              Principles, not programs:
            </p>
            <div className="ed-text">
              {BELIEFS.map((b) => (
                <div className="kv" key={b}>
                  <span className="t-body">{b}</span>
                </div>
              ))}
            </div>
          </Sec>

          <Sec
            label="What we built"
            heading="So we built a different kind of place."
          >
            <p className="t-lede ed-text" style={{ marginBottom: 24 }}>
              The Upskilling Labs is a community built around a simple idea: learning
              sticks when you use it. You learn, you practice, you build — together.
              Born at DC Public Library in fall 2025, run in the open ever since.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {BUILT.map(([t, b]) => (
                <div className="lcard" style={{ padding: 20 }} key={t}>
                  <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                    {t}
                  </div>
                  <p className="t-small">{b}</p>
                </div>
              ))}
            </div>
          </Sec>

          <Sec
            label="What happens here"
            heading="Transformation happens through practice."
            aside={<RailQuote>You leave more capable than you arrived.</RailQuote>}
          >
            <p className="t-lede ed-text" style={{ marginBottom: 20 }}>
              You might…
            </p>
            <div className="ed-text">
              {HAPPENS.map((b) => (
                <div className="kv" key={b}>
                  <span className="t-body">{b}</span>
                </div>
              ))}
            </div>
          </Sec>

          <Sec
            label="Who belongs here"
            heading="You don’t need to have it all figured out."
          >
            <p className="t-lede ed-text" style={{ marginBottom: 20 }}>
              Not credentials. Not a profession. A mindset. The people who thrive here
              are…
            </p>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}
            >
              {MINDSET.map((t) => (
                <span className="chip" style={{ cursor: "default" }} key={t}>
                  {t}
                </span>
              ))}
            </div>
            <p className="t-body ed-text" style={{ fontWeight: 600 }}>
              If you’re willing to grow, you belong here.
            </p>
          </Sec>

          <Sec
            label="Looking forward"
            heading="We’re building for a future none of us can predict."
          >
            <p className="t-lede ed-text" style={{ marginBottom: 16 }}>
              The Labs isn’t preparing you for one job or one technology. It’s how you
              build the capacity to navigate change — this year’s, and every year
              after.
            </p>
            <p className="t-body ed-text">
              That’s the mission. Not preparing people for the future. Helping people
              become the kind of people who can help create it.
            </p>
          </Sec>

          <Sec label="Join" heading="This is just the beginning.">
            <p className="t-lede ed-text" style={{ marginBottom: 24 }}>
              Whether you’re looking to challenge yourself, contribute to something
              meaningful, meet extraordinary people, or simply become more capable
              than you were yesterday, there’s a place for you here.
            </p>
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}
            >
              <Link className="btn btn-red btn-lg" href="/build-cycles">
                Explore how The Labs works
              </Link>
              <Link className="see" href="/login">
                Ready now? Join The Labs →
              </Link>
            </div>
          </Sec>
        </div>
      </div>
    </>
  );
}
