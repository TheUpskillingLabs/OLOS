import Link from "next/link";
import { Crumbs } from "@/app/components/content/teasers";

/* The public About page — a faithful port of onboarding-proto's
   tools/generate.js aboutPage(): the dark hero, then a 760px column of
   perspective → beliefs → what we built → what happens here → who belongs
   → looking forward, closing on the Build Cycles CTA. Copy is byte-for-byte
   from the generator (the design source of truth). */


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
  ["Build Cycles", "Thirteen weeks, a real problem, a small team that ships."],
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

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="lbl lbl-teal" style={{ marginBottom: 12 }}>
      {children}
    </div>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 24,
        fontWeight: 600,
        lineHeight: "34px",
        letterSpacing: "-.02em",
        color: "var(--ink)",
        borderLeft: "2px solid var(--teal)",
        paddingLeft: 24,
        marginBottom: 56,
      }}
    >
      {children}
    </p>
  );
}

export default function AboutPage() {
  return (
    <>
      <div className="container">
        <Crumbs trail={TRAIL} />
      </div>

      {/* ── Dark hero (the generator's darkHero()) ── */}
      <section className="grain" style={{ background: "var(--ink)", color: "#fff" }}>
        <div className="container" style={{ maxWidth: 760, paddingTop: 56, paddingBottom: 56 }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
            About
          </div>
          <h1 className="t-h1" style={{ maxWidth: "24ch" }}>
            We believe people are capable of far more than they’ve been given the
            opportunity to prove.
          </h1>
          <p className="t-lede" style={{ marginTop: 18, maxWidth: "52ch", color: "var(--od2)" }}>
            The world has changed. Knowledge is everywhere. AI is transforming how
            work gets done. Careers are becoming less predictable, more
            interdisciplinary, and more self-directed.
          </p>
          <p className="t-lede" style={{ marginTop: 14, maxWidth: "52ch", color: "var(--od2)" }}>
            The challenge isn’t keeping up with information. It’s becoming the kind
            of person who can make sense of change — and help shape what comes next.
          </p>
          <p
            className="t-lede"
            style={{ marginTop: 14, maxWidth: "52ch", color: "var(--od1)", fontWeight: 600 }}
          >
            That’s why The Upskilling Labs exists.
          </p>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 56, paddingBottom: 24, maxWidth: 760 }}>
        {/* ── Our perspective ── */}
        <Eyebrow>Our perspective</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          The way we learn hasn’t kept pace with the world.
        </h2>
        <p className="t-lede" style={{ marginBottom: 16 }}>
          Knowledge used to be the hard part. Now it’s everywhere, and AI is putting
          expertise within anyone’s reach. The skills that matter change faster every
          year.
        </p>
        <p className="t-body" style={{ marginBottom: 28 }}>
          What work rewards now is different: curiosity, judgment, collaboration, and
          the ability to adapt. The future belongs to people who keep growing what
          they’re capable of.
        </p>
        <PullQuote>
          We don’t think the answer is more information. We think it’s learning that
          becomes capability.
        </PullQuote>

        {/* ── What we believe ── */}
        <Eyebrow>What we believe</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          Capability changes everything.
        </h2>
        <p className="t-lede" style={{ marginBottom: 20 }}>
          Principles, not programs:
        </p>
        <div style={{ marginBottom: 56 }}>
          {BELIEFS.map((b) => (
            <div className="kv" key={b}>
              <span className="t-body">{b}</span>
            </div>
          ))}
        </div>

        {/* ── What we built ── */}
        <Eyebrow>What we built</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          So we built a different kind of place.
        </h2>
        <p className="t-lede" style={{ marginBottom: 24 }}>
          The Upskilling Labs is a community built around a simple idea: learning
          sticks when you use it. You learn, you practice, you build — together. Born
          at DC Public Library in fall 2025, run in the open ever since.
        </p>
        <div className="cards two" style={{ marginBottom: 56 }}>
          {BUILT.map(([t, b]) => (
            <div className="lcard" style={{ padding: 22 }} key={t}>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                {t}
              </div>
              <p className="t-small">{b}</p>
            </div>
          ))}
        </div>

        {/* ── What happens here ── */}
        <Eyebrow>What happens here</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          Transformation happens through practice.
        </h2>
        <p className="t-lede" style={{ marginBottom: 20 }}>
          You might…
        </p>
        <div style={{ marginBottom: 28 }}>
          {HAPPENS.map((b) => (
            <div className="kv" key={b}>
              <span className="t-body">{b}</span>
            </div>
          ))}
        </div>
        <PullQuote>You leave more capable than you arrived.</PullQuote>

        {/* ── Who belongs here ── */}
        <Eyebrow>Who belongs here</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          You don’t need to have it all figured out.
        </h2>
        <p className="t-lede" style={{ marginBottom: 20 }}>
          Not credentials. Not a profession. A mindset. The people who thrive here
          are…
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {MINDSET.map((t) => (
            <span className="chip" style={{ cursor: "default" }} key={t}>
              {t}
            </span>
          ))}
        </div>
        <p className="t-body" style={{ fontWeight: 600, marginBottom: 56 }}>
          If you’re willing to grow, you belong here.
        </p>

        {/* ── Looking forward ── */}
        <Eyebrow>Looking forward</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          We’re building for a future none of us can predict.
        </h2>
        <p className="t-lede" style={{ marginBottom: 16 }}>
          The Labs isn’t preparing you for one job or one technology. It’s how you
          build the capacity to navigate change — this year’s, and every year after.
        </p>
        <p className="t-body" style={{ marginBottom: 56 }}>
          That’s the mission. Not preparing people for the future. Helping people
          become the kind of people who can help create it.
        </p>

        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          This is just the beginning.
        </h2>
        <p className="t-lede" style={{ marginBottom: 24 }}>
          Whether you’re looking to challenge yourself, contribute to something
          meaningful, meet extraordinary people, or simply become more capable than
          you were yesterday, there’s a place for you here.
        </p>
        <Link className="btn btn-red btn-lg" href="/build-cycles">
          Explore how The Labs works
        </Link>
        <p style={{ marginTop: 16, marginBottom: 32 }}>
          <Link className="see" href="/login">
            Ready now? Join The Labs →
          </Link>
        </p>
      </div>
    </>
  );
}
