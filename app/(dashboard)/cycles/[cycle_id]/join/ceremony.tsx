"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FlowScreen,
  type FlowStep,
  type FlowAnswers,
} from "@/app/components/flow/flow-screen";
import {
  coreEvents,
  fmtEvt,
  icsHref,
  ANCHOR_EVENTS,
} from "@/lib/cycles/anchor-events";
import { OPEN_CYCLE_AGREEMENT_VERSION } from "@/lib/validations/cycle-agreement";

/* ════════════════════════════════════════════════════════════════════════
   The cycle registration ceremony — ported from onboarding-proto:
     view-cycle-threshold → two beats: value BEFORE terms, terms BEFORE
       effort (facilitator feedback). "Not now" is a respectable exit on both.
     FLOWS('cycle')       → four questions on the shared flow engine, then
       the Open Cycle Agreement signature step (ceremony after intent —
       signing completes registration; scroll-gated like every agreement).
     view-cycle-signed    → kickoff, the .ics of the anchor events, pod CTA.
   Copy is owner-approved (Red Antler voice; gravity moments stay weighty in
   plain language) — change it in the prototype first.
   ════════════════════════════════════════════════════════════════════════ */

const HOURS = ["2–4 hrs / week", "5–8 hrs / week", "8+ hrs / week"];

function cycleSteps(cycleName: string, fullName: string): FlowStep[] {
  return [
    {
      id: "theme_interest",
      type: "textarea",
      required: false,
      q: "What draws you to this cycle’s theme?",
      help: "No wrong answer — “the timing’s finally right for me” counts. Skip it if you’d rather.",
      ph: "e.g. local elections have been on my mind for a while…",
    },
    {
      id: "learning_goals",
      type: "textarea",
      q: "What do you want to learn or get sharper at?",
      help: "A line is plenty.",
      ph: "e.g. get comfortable shipping a real data pipeline",
    },
    {
      id: "professional_goals",
      type: "textarea",
      q: "Where are you hoping this takes you?",
      help: "A line is plenty — a job, a portfolio piece, a new direction.",
      ph: "e.g. a project I can point employers to",
    },
    {
      id: "hours",
      type: "choice",
      q: "How much time can you commit?",
      options: HOURS.map((h) => ({ v: h, label: h })),
    },
    {
      id: "signature",
      type: "signature",
      q: "The Open Cycle Agreement",
      help: "Signing is how your pod knows you mean it. It’s short — read the whole thing.",
      intro: `Between you and The Upskilling Labs, for ${cycleName}. It’s short on purpose — read all of it.`,
      terms: [
        {
          title: "I’ll be there.",
          body: "In person, at the five core events: the Problem Sprint, Meet the Pods, the Hackathon, Meet the Projects, and the Showcase Summit. My pod plans around me being there.",
        },
        {
          title: "I’ll check in every week.",
          body: "Five minutes, once a week. If I skip it, the app pauses until I catch up. If life gets in the way, I’ll tell my Poderator instead of going quiet.",
        },
        {
          title: "Our project is open source.",
          body: "What we build is an open-source community project — MIT for code, CC BY 4.0 for everything else, with everyone who worked on it credited. Once the cycle ends, I’m free to do whatever I want with it, and so is anyone else.",
        },
      ],
      versionLine: `Version ${OPEN_CYCLE_AGREEMENT_VERSION} · If circumstances change mid-cycle, talk to your Poderator — leaving well is respected; going quiet is not.`,
      ph: fullName || "Your full name",
    },
  ];
}

export default function CycleCeremony({
  cycleId,
  cycleName,
  fullName,
  fromSignup,
  alreadySigned,
  signedAt,
  podRegistrationOpen,
}: {
  cycleId: number;
  cycleName: string;
  fullName: string;
  fromSignup: boolean;
  alreadySigned: boolean;
  signedAt: string | null;
  podRegistrationOpen: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<"ts1" | "ts2" | "flow" | "signed">(
    alreadySigned ? "signed" : "ts1"
  );
  const [signedNow, setSignedNow] = useState<string | null>(signedAt);
  const steps = useMemo(
    () => cycleSteps(cycleName, fullName),
    [cycleName, fullName]
  );

  const eyebrow = fromSignup
    ? "Your account is ready ✓"
    : `${cycleName} · An Open Cycle`;

  const submit = async (answers: FlowAnswers): Promise<string | null> => {
    const res = await fetch(`/api/cycles/${cycleId}/agreement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature_name: String(answers.signature ?? "").trim(),
        agreement_version: OPEN_CYCLE_AGREEMENT_VERSION,
        answers: {
          theme_interest: String(answers.theme_interest ?? ""),
          learning_goals: String(answers.learning_goals ?? ""),
          professional_goals: String(answers.professional_goals ?? ""),
          hours: String(answers.hours ?? ""),
        },
      }),
    }).catch(() => null);

    const json = res ? await res.json().catch(() => null) : null;
    if (res?.ok && json?.agreement) {
      setSignedNow(json.agreement.signed_at ?? new Date().toISOString());
      setStage("signed");
      return null;
    }
    return json?.error || "That didn’t go through — try again.";
  };

  if (stage === "flow") {
    return (
      <div className="fixed inset-0 z-[70]">
        <FlowScreen
          eyebrow={`${cycleName} · An Open Cycle`}
          steps={steps}
          finalLabel="Sign & register"
          finalClass="btn-red"
          submittingLabel="Signing…"
          onComplete={submit}
          onExit={() => setStage("ts2")}
        />
      </div>
    );
  }

  if (stage === "signed") {
    return <SignedScreen cycleId={cycleId} signedAt={signedNow} podRegistrationOpen={podRegistrationOpen} />;
  }

  /* ── The threshold (dark cover, two beats) ── */
  const kickoff = ANCHOR_EVENTS.find((e) => e.kickoff);
  const kickoffShort = kickoff
    ? fmtEvt(kickoff).split(" · ")[0] // "Jul 14"
    : "Jul 14";

  return (
    <div className="fixed inset-0 z-[70] view s-cover grain on-dark" style={{ animation: "none" }}>
      <div className="vscroll" style={{ flex: 1, minHeight: 0 }}>
        <div className="container" style={{ maxWidth: 560, padding: "48px 24px 24px" }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 18 }}>
            {eyebrow}
          </div>

          {stage === "ts1" && (
            /* Beat 1 · Benefits first, rooted in the member's hero's journey:
               open with where THEY end up, then the path, then what it takes. */
            <div>
              <h1 className="t-display" style={{ marginBottom: 14 }}>
                Three months from now, you’ll have built something real.
              </h1>
              <p className="t-lede" style={{ color: "var(--od2)", marginBottom: 28 }}>
                You’ll pick a problem that matters to you, team up, and see it
                through — with mentors and a whole community behind you.
              </p>
              <ThCard label="What you walk away with">
                Something real you helped build, proof of it on your profile,
                and people who’ve seen what you can do.
              </ThCard>
              <ThCard label="How you get there">
                Month one: dig into a real problem with your pod. Month two:
                decide what to build at the Hackathon. Month three: build it,
                test it, and show it.
              </ThCard>
              <ThCard label="What it takes">
                Six in-person events, a five-minute check-in each week, and the
                rest on your own time with your team.
              </ThCard>
            </div>
          )}

          {stage === "ts2" && (
            /* Beat 2 · The deal (three commitments, plain speech) */
            <div>
              <h1 className="t-display" style={{ marginBottom: 14 }}>
                Here’s the deal.
              </h1>
              <p className="t-lede" style={{ color: "var(--od2)", marginBottom: 28 }}>
                Three things. They’re what makes a cycle work, and you’ll put
                your name to them.
              </p>
              <div className="th-card">
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  1 · Show up
                </div>
                <div className="t-h4" style={{ marginBottom: 6 }}>
                  Be at the five core events
                </div>
                <p className="t-small" style={{ color: "var(--od2)", marginBottom: 8 }}>
                  Kickoff ({kickoffShort}) gets it started. These five are
                  where the whole cycle happens in person — your pod plans
                  around you being there.
                </p>
                <div>
                  {coreEvents().map((e) => (
                    <div className="th-ev" key={e.api_id}>
                      <span className="t-small" style={{ color: "var(--od1)", fontWeight: 600 }}>
                        ✦ {e.name}
                      </span>
                      <span className="t-small" style={{ color: "var(--od2)", flexShrink: 0 }}>
                        {fmtEvt(e)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="th-card">
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  2 · Check in
                </div>
                <div className="t-h4" style={{ marginBottom: 6 }}>
                  Once a week, five minutes
                </div>
                <p className="t-small" style={{ color: "var(--od2)" }}>
                  One short log each week so your pod knows where you’re at. If
                  you skip it, the app pauses until you catch up. And if life
                  gets busy, just tell your Poderator — that’s always okay.
                </p>
              </div>
              <div className="th-card">
                <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
                  3 · Open source
                </div>
                <div className="t-h4" style={{ marginBottom: 6 }}>
                  The projects belong to everyone
                </div>
                <p className="t-small" style={{ color: "var(--od2)" }}>
                  Everything a team builds here is an open-source community
                  project. When the cycle’s over, you’re free to do whatever
                  you want with it — and so is everyone else. MIT for code, CC
                  BY 4.0 for the rest, with everyone who worked on it credited.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
      {/* Pinned action bar — the primary CTA stays in the thumb zone on
          mobile (mirrors the account-creation flow's sticky .actionbar). */}
      <div
        className="actionbar"
        style={{
          background: "var(--ink)",
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <div style={{ maxWidth: 560, width: "100%", margin: "0 auto" }}>
          <button
            className="btn btn-red btn-lg btn-block"
            onClick={() => setStage(stage === "ts1" ? "ts2" : "flow")}
          >
            {stage === "ts1" ? "See the commitment →" : "Begin registration →"}
          </button>
          <button
            className="btn-link"
            style={{
              color: "var(--od2)",
              marginTop: 12,
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
            onClick={() => router.push("/dashboard")}
          >
            Not now — stay a member, browse the free events
          </button>
        </div>
      </div>
    </div>
  );
}

function ThCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="th-card">
      <div className="lbl lbl-teal" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <p className="t-small" style={{ color: "var(--od2)" }}>
        {children}
      </p>
    </div>
  );
}

/* ── view-cycle-signed — the confirmation ── */
function SignedScreen({
  cycleId,
  signedAt,
  podRegistrationOpen,
}: {
  cycleId: number;
  signedAt: string | null;
  podRegistrationOpen: boolean;
}) {
  const kickoff = ANCHOR_EVENTS.find((e) => e.kickoff);
  const kickoffLong = kickoff
    ? new Date(kickoff.start_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "July 14";
  const signedLong = signedAt
    ? new Date(signedAt).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "today";

  return (
    <div className="fixed inset-0 z-[70] view light s-paper" style={{ animation: "none" }}>
      <div
        className="vscroll"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="container" style={{ maxWidth: 520, textAlign: "center", padding: "48px 24px" }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 18 }}>
            Registration complete
          </div>
          <h1 className="t-h1" style={{ marginBottom: 12 }}>
            You&rsquo;re registered ✓
          </h1>
          <p className="t-lede" style={{ marginBottom: 8 }}>
            See you at Kickoff — {kickoffLong}, DC Public Library.
          </p>
          <p className="t-small" style={{ marginBottom: 28 }}>
            Open Cycle Agreement · signed {signedLong} — it lives on your
            profile.
          </p>
          <a
            className="btn btn-ghost-teal btn-block"
            style={{ marginBottom: 12 }}
            download="open-cycle-events.ics"
            href={icsHref()}
          >
            Add the cycle&rsquo;s events to your calendar
          </a>
          <p className="t-small" style={{ color: "var(--meta)" }}>
            Your committed dates live on your cycle page and dashboard — find
            them there anytime.
          </p>
        </div>
      </div>
      {/* Pinned action bar — primary CTA in the thumb zone on mobile. */}
      <div className="actionbar light-bar">
        <div style={{ maxWidth: 520, width: "100%", margin: "0 auto" }}>
          {podRegistrationOpen ? (
            <>
              <Link
                className="btn btn-teal btn-lg btn-block"
                href={`/cycles/${cycleId}/register-pods`}
              >
                Choose your pod →
              </Link>
              <Link
                className="btn-link"
                style={{
                  color: "var(--meta)",
                  marginTop: 12,
                  display: "block",
                  textAlign: "center",
                }}
                href={`/cycles/${cycleId}`}
              >
                Go to your cycle →
              </Link>
            </>
          ) : (
            <Link
              className="btn btn-teal btn-lg btn-block"
              href={`/cycles/${cycleId}`}
            >
              Go to your cycle →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
