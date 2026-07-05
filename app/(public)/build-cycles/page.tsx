import Link from "next/link";
import { Crumbs } from "@/app/components/content/teasers";
import { getEvents } from "@/lib/content/queries";
import { fmtDate, fmtDay } from "@/lib/content/format";

/* The public Build Cycles page — a faithful port of onboarding-proto's
   tools/generate.js cyclesPage(): the dark hero, the four promise cards,
   the current cycle (anchor events from the events table), the three
   phases, the situations strip, and the register CTA. Copy is byte-for-byte
   from the generator (the design source of truth). The past-projects block
   waits for the Work layer. */


// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Build Cycles · The Upskilling Labs",
  description:
    "Three months from now, you’ll have built something real. Pick a problem, team up, and see it through — in the open.",
};

const TRAIL: [string, string | null][] = [
  ["Home", "/"],
  ["Build Cycles", null],
];

// The current cycle's public shape, inlined from the prototype's
// cycles/data.js (CYCLE_PUBLIC + SITUATIONS). These constants move to the
// `cycles` and `problem_situations` tables when the public cycle API lands
// (docs/OLOS_BACKEND_CHANGES.md §2/§8).
const CYCLE = {
  name: "Summer 2026",
  theme: "Civic & Elections",
  city: "Washington, DC",
  kickoff: "2026-07-14T18:00",
  weeks: 12,
};

const PHASES = [
  {
    title: "Problem Sprint",
    when: "Weeks 1–5",
    body: "The cycle starts by looking, not building. Everyone collects things they’ve actually seen, we map them together in the Triangulator, and pods form around the problems that keep showing up. By week 5, your pod picks one to own.",
  },
  {
    title: "Frame Sprint",
    when: "Weeks 6–9",
    body: "Your pod digs into its problem — interviews, field visits, homework nobody assigned. At the Hackathon, all that digging becomes proposals: new ways of seeing the problem, and what to build about it. Then everyone votes.",
  },
  {
    title: "Building",
    when: "Weeks 10–12",
    body: "Winning proposals become teams of 3–5. You build something real, test it with real people, and bring everything — the wins and the misses — back to the commons at the Showcase Summit.",
  },
];

const SITUATIONS = [
  { title: "Benefits navigation dead-ends", owner: "DC Public Library" },
  { title: "First-time voter information gap", owner: "League of Women Voters DC" },
  { title: "Volunteer knowledge walks out the door", owner: "Civic Tech DC" },
];

const PROMISES: [string, string][] = [
  [
    "What you walk away with",
    "Something real you helped build, proof of it on your profile, and people who’ve seen what you can do.",
  ],
  [
    "How you get there",
    "Month one: dig into a real problem with your pod. Month two: decide what to build at the Hackathon. Month three: build it, test it, and show it.",
  ],
  [
    "What it takes",
    "Six in-person events, a five-minute check-in each week, and the rest on your own time with your team.",
  ],
  [
    "Open source, on purpose",
    "Everything a team builds here is an open-source community project. When the cycle’s over, you’re free to do whatever you want with it — and so is everyone else.",
  ],
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="lbl lbl-teal" style={{ marginBottom: 12 }}>
      {children}
    </div>
  );
}

export default async function BuildCyclesPage() {
  const events = await getEvents();
  const anchors = events.filter((e) => e.anchor);

  return (
    <>
      <div className="container">
        <Crumbs trail={TRAIL} />
      </div>

      {/* ── Dark hero (the generator's darkHero()) ── */}
      <section className="grain" style={{ background: "var(--ink)", color: "#fff" }}>
        <div className="container" style={{ maxWidth: 760, paddingTop: 56, paddingBottom: 56 }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
            Build Cycles · 4 a year
          </div>
          <h1 className="t-h1" style={{ maxWidth: "22ch" }}>
            Three months from now, you’ll have built something real.
          </h1>
          <p className="t-lede" style={{ marginTop: 18, maxWidth: "52ch", color: "var(--od2)" }}>
            You’ll pick a problem that matters to you, team up, and see it through —
            with mentors and a whole community behind you.
          </p>
          <div style={{ marginTop: 28 }}>
            <Link className="btn btn-red btn-lg" href="/login">
              Register for this cycle
            </Link>
          </div>
        </div>
      </section>

      <div className="container" style={{ paddingTop: 56, paddingBottom: 24, maxWidth: 760 }}>
        {/* ── The four promise cards ── */}
        <div className="cards two" style={{ marginBottom: 56 }}>
          {PROMISES.map(([t, b]) => (
            <div className="lcard" style={{ padding: 22 }} key={t}>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                {t}
              </div>
              <p className="t-small">{b}</p>
            </div>
          ))}
        </div>

        {/* ── The current cycle ── */}
        <Eyebrow>The current cycle</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          {CYCLE.theme} · {CYCLE.name}
        </h2>
        <p className="t-lede" style={{ marginBottom: 24 }}>
          {CYCLE.city} · Kickoff {fmtDay(CYCLE.kickoff)} · {CYCLE.weeks} weeks · An
          Open Cycle — every project is open source.
        </p>
        <div className="lcard" style={{ padding: "22px 24px", marginBottom: 56 }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
            The six anchor events
          </div>
          {anchors.map((e) => (
            <div className="kv" key={e.slug}>
              <span className="k lbl" style={{ width: 110 }}>
                {fmtDate(e.start_at)}
              </span>
              <span className="t-body">
                ✦{" "}
                <Link href={`/events/${e.slug}`} style={{ color: "inherit" }}>
                  {e.name}
                </Link>
                <span className="t-small" style={{ color: "var(--meta)" }}>
                  {" "}
                  · {e.location_name}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* ── How it works ── */}
        <Eyebrow>How it works</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          Three phases, one arc.
        </h2>
        <div className="cards two" style={{ marginBottom: 56 }}>
          {PHASES.map((ph) => (
            <div className="lcard" style={{ padding: 22 }} key={ph.title}>
              <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                {ph.title} · {ph.when}
              </div>
              <p className="t-small">{ph.body}</p>
            </div>
          ))}
        </div>

        {/* ── What this cycle is working on ── */}
        <Eyebrow>What this cycle is working on</Eyebrow>
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          Real problems, brought by real partners.
        </h2>
        <div style={{ marginBottom: 56 }}>
          {SITUATIONS.map((si) => (
            <div className="kv" key={si.title}>
              <span className="t-body">
                {si.title}
                <span className="t-small" style={{ color: "var(--meta)" }}>
                  {" "}
                  · Brought by {si.owner}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* ── Ready? ── */}
        <h2 className="t-h2" style={{ marginBottom: 16 }}>
          Ready?
        </h2>
        <p className="t-lede" style={{ marginBottom: 24 }}>
          Registration takes a few minutes. The commitment is real, and so is what
          you’ll build.
        </p>
        <Link className="btn btn-red btn-lg" href="/login">
          Register for this cycle
        </Link>
        <p style={{ marginTop: 16, marginBottom: 32 }}>
          <Link className="see" href="/events/kickoff-summit">
            Just curious? Come to Kickoff →
          </Link>
        </p>
      </div>
    </>
  );
}
