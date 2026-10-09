import Link from "next/link";
import { EditorialHeader, EdSection, EdRow } from "@/app/components/chrome/editorial";
import { getEvents } from "@/lib/content/queries";
import { fmtDate } from "@/lib/content/format";
import { createServiceClient } from "@/lib/supabase/server";
import { internalCycleJoinUrl, whatsNextMessage } from "@/lib/cycles/whats-next";
import { getWhatsNextFacts } from "@/lib/cycles/whats-next-data";

/* The public Build Cycles page — recomposed on the editorial "standards-manual"
   grid (ref: 1976 NASA Graphics Standards Manual, Column Five, The Futur) as a
   stack of ROWS: the dark header (eyebrow + headline own the
   head row, standfirst + register CTA beneath), then body sections whose eyebrow
   + heading share the head row and whose content — the promise, the current
   cycle's anchor events, the partner problems — flows in the
   rows beneath. Copy is byte-for-byte from the generator (tools/generate.js
   cyclesPage(), the design source of truth) except the cycle-specific blocks:
   since 2026-10-03 (epic #477) no public cycle is recruiting — Cycle 4 runs as
   an internal org cycle — so the page describes how a cycle works, says
   what's next (lib/cycles/whats-next.ts: the internal cycle as an invitation
   to people who have taken part before, the public workshops, and the next
   public kickoff), and points people to the workshops and events rather than
   "register for this cycle". Lane U (#414)
   replaces this with the four-state page reading cycle data. The
   past-projects block waits for the Work layer. */


// The (public) layout reads request cookies for the auth-aware nav —
// always rendered per request, never prerendered at build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Build Cycles · The Upskilling Labs",
  description:
    "Pick a problem, team up, and see it through — in the open. How a Build Cycle works, and when the next public one kicks off.",
};


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
  const [events, facts] = await Promise.all([
    getEvents(),
    getWhatsNextFacts(createServiceClient()),
  ]);
  const m = whatsNextMessage(facts);
  // Only anchor events still ahead — a past cycle's dates are not an invitation.
  const now = new Date();
  const anchors = events.filter(
    (e) => e.anchor && new Date(e.end_at ?? e.start_at) >= now
  );

  return (
    <>
      {/* ── Header: eyebrow + headline (head row); standfirst + register (beneath) ── */}
      <EditorialHeader
        eyebrow="Build Cycles"
        title="Build something real, with a team."
        standfirst="You’ll pick a problem that matters to you, team up, and see it through — with mentors and a whole community behind you."
      >
        <div className="ed-cols">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
            <Link className="btn btn-red btn-lg" href="/events">
              {m.eventsCta}
            </Link>
          </div>
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

          {/* What's next — no public cycle is recruiting (epic #477): the
              internal cycle as an invitation, what keeps running, the next
              public kickoff, and any public anchor events ahead. */}
          <EdSection eyebrow={m.chip} heading={m.heading}>
            <div className="ed-cols">
              <div className="ed-text">
                {m.internal && (
                  <p className="t-lede" style={{ marginBottom: 12 }}>
                    {m.internal}{" "}
                    <a
                      href={internalCycleJoinUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--teal-deep)", fontWeight: 600 }}
                    >
                      Join it on Slack →
                    </a>
                  </p>
                )}
                <p className="t-lede" style={{ marginBottom: 12 }}>
                  {m.notChanging}
                </p>
                <p className="t-lede" style={{ fontWeight: 600 }}>
                  {m.nextPublic}
                </p>
              </div>
            </div>
            {anchors.length > 0 && (
              <div className="ed-cols">
              <div>
                <div className="lbl lbl-teal" style={{ marginBottom: 12 }}>
                  Public events coming up
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


          {/* The closing CTA — the workshops and events (an account, not a cycle registration) */}
          <EdSection eyebrow="Join" heading="Start with The Labs now.">
            <div className="ed-cols">
              <div>
                <p className="t-lede ed-text" style={{ marginBottom: 24 }}>
                  An account is free and takes a minute. You&rsquo;ll get the
                  workshops, the Library, and a dashboard. Start with a workshop
                  or event.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <Link className="btn btn-red btn-lg" href="/events">
                    {m.eventsCta}
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
