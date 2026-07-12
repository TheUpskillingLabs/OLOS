import Link from "next/link";
import { EditorialHeader, EdSection, EdRow } from "@/app/components/chrome/editorial";
import { getEvents } from "@/lib/content/queries";
import { fmtDate, fmtDay } from "@/lib/content/format";

/* The public Build Cycles page — recomposed on the editorial "standards-manual"
   grid (ref: 1976 NASA Graphics Standards Manual, Column Five, The Futur) as a
   stack of ROWS: the dark header (eyebrow + headline own the
   head row, standfirst + register CTA beneath), then body sections whose eyebrow
   + heading share the head row and whose content — the promise, the current
   cycle's anchor events, the partner problems — flows in the
   rows beneath. Copy is byte-for-byte from the generator (tools/generate.js
   cyclesPage(), the design source of truth). The past-projects block waits for
   the Work layer. */


// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Build Cycles · The Upskilling Labs",
  description:
    "Three months from now, you’ll have built something real. Pick a problem, team up, and see it through — in the open.",
};

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

export default async function BuildCyclesPage() {
  const events = await getEvents();
  const anchors = events.filter((e) => e.anchor);

  return (
    <>
      {/* ── Header: eyebrow + headline (head row); standfirst + register (beneath) ── */}
      <EditorialHeader
        eyebrow="Build Cycles · 4 a year"
        title="Three months from now, you’ll have built something real."
        standfirst="You’ll pick a problem that matters to you, team up, and see it through — with mentors and a whole community behind you."
      >
        <div className="ed-cols">
          <Link className="btn btn-red btn-lg" href="/login">
            Register for this cycle
          </Link>
        </div>
      </EditorialHeader>

      {/* ── Body ── */}
      <div className="container" style={{ paddingTop: 88, paddingBottom: 56 }}>
        <div className="ed-doc">
          {/* The promise — the four cards, as same-hierarchy columns */}
          <EdSection eyebrow="The promise" heading="Here’s the deal.">
            <EdRow cols={2}>
              {PROMISES.map(([t, b]) => (
                <div key={t}>
                  <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                    {t}
                  </div>
                  <p className="t-body ed-text" style={{ color: "var(--slate)" }}>
                    {b}
                  </p>
                </div>
              ))}
            </EdRow>
          </EdSection>

          {/* The current cycle — theme + name head row; details and anchor events beneath */}
          <EdSection
            eyebrow="The current cycle"
            heading={`${CYCLE.theme} · ${CYCLE.name}`}
          >
            <div className="ed-cols">
              <p className="t-lede ed-text">
                {CYCLE.city} · Kickoff {fmtDay(CYCLE.kickoff)} · {CYCLE.weeks} weeks
                · An Open Cycle — every project is open source.
              </p>
            </div>
            {anchors.length > 0 && (
              <div className="ed-cols">
              <div>
                <div className="lbl lbl-teal" style={{ marginBottom: 12 }}>
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
            </div>
            )}
          </EdSection>

          {/* What this cycle is working on — partner problems, a single-hierarchy list */}
          <EdSection
            eyebrow="What this cycle is working on"
            heading="Real problems, brought by real partners."
          >
            <div className="ed-cols">
              <div>
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
            </div>
          </EdSection>

          {/* Register — the closing CTA */}
          <EdSection eyebrow="Register" heading="Ready?">
            <div className="ed-cols">
              <div>
                <p className="t-lede ed-text" style={{ marginBottom: 24 }}>
                  Registration takes a few minutes. The commitment is real, and so
                  is what you’ll build.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <Link className="btn btn-red btn-lg" href="/login">
                    Register for this cycle
                  </Link>
                  <Link className="see" href="/events/kickoff-summit">
                    Just curious? Come to Kickoff →
                  </Link>
                </div>
              </div>
            </div>
          </EdSection>
        </div>
      </div>
    </>
  );
}
