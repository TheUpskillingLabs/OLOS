"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Orb from "@/app/components/chrome/orb";
import {
  FlowScreen,
  type FlowStep,
  type FlowAnswers,
} from "@/app/components/flow/flow-screen";
import { STANDPOINTS } from "@/lib/validations/survey-response";

/* The field survey as a one-question-at-a-time flow (SENSEMAKING_FLOW.md §3),
   on the shared FlowScreen engine — the same shell as registration + the cycle
   ceremony. Full-bleed (the (survey) group has no nav/footer). A branded welcome
   cover → the questions → a ✓ confirmation that invites the visitor to join.
   Posts the identical payload to /api/surveys/[slug]/responses — the collection
   UX changed, the contract did not. */

type Standpoint = (typeof STANDPOINTS)[number];

const STANDPOINT_LABELS: Record<Standpoint, string> = {
  work_in_field: "I work in this field",
  affected: "I've been personally affected by it",
  tried_to_fix: "I've tried to fix something like this before",
  research: "I research or study this area",
  pay_attention: "I just pay close attention",
  other: "Other",
};

const SALIENCE_LOW = "I noticed it in passing";
const SALIENCE_HIGH = "This is something I think about a lot";

function surveySteps(domain: string): FlowStep[] {
  const d = domain.toLowerCase();
  return [
    {
      id: "observation",
      type: "textarea",
      q: `What are you observing in the field of ${d}?`,
      help: "What feels stuck, broken, or missing — a problem that keeps coming back no matter what people try? A sentence is fine. So is a page.",
      ph: "Just tell us what you see.",
    },
    {
      id: "experience",
      type: "multiselect",
      q: "What's your experience with this?",
      help: "Optional — pick any that apply. It helps us weigh who's speaking.",
      options: STANDPOINTS.map((s) => ({ v: s, label: STANDPOINT_LABELS[s] })),
    },
    {
      id: "salience",
      type: "scale",
      q: "How much does this matter to you personally?",
      help: "Optional.",
      optional: true,
      lowLabel: SALIENCE_LOW,
      highLabel: SALIENCE_HIGH,
    },
    {
      id: "prior_attempts",
      type: "textarea",
      required: false,
      q: "Has anyone tried to address this before?",
      help: "Even if it didn't work — especially if it didn't work. What happened? Optional.",
      ph: "What was tried, and how it went…",
    },
    {
      id: "contact",
      type: "fields",
      q: "Want to stay in touch?",
      help: "Optional. Share these only if you're open to program participants following up on your observation — your info goes only to those who use it. Leave blank to stay anonymous.",
      fields: [
        { id: "name", label: "Your name", ph: "e.g. Priya Shah", required: false, half: true },
        { id: "email", label: "Email", ph: "you@example.com", required: false, half: true },
        { id: "phone", label: "Phone (optional)", ph: "If you prefer a call or text", required: false },
      ],
    },
    {
      id: "mentor",
      type: "choice",
      q: `Interested in mentoring in the ${domain} Build Cycle?`,
      help: "Mentors guide a pod through the cycle. Say yes and add your name + email above so we can reach you.",
      options: [
        { v: "yes", label: "Yes, I'm interested" },
        { v: "no", label: "Not right now" },
      ],
    },
    {
      id: "consent",
      type: "consent",
      q: "One last thing",
      agreementTitle: "How your observation is used",
      agreement: [
        {
          h: `What you're contributing to`,
          p: `The Upskilling Labs collects field observations to choose the problems its next ${domain} Build Cycle takes on. Your observation joins an open, participant-built insights repository; everything Upskillers produce from it is open-source.`,
        },
        {
          h: "Voluntary and anonymous",
          p: "Submitting is voluntary, and your observation is anonymous unless you shared contact details. You can share as little or as much as you like.",
        },
      ],
      text: "I have read and understood the above. I consent to my submission being used by The Upskilling Labs in the development of public projects and shared with program participants for research and project-development purposes.",
    },
  ];
}

export default function SurveyFlow({
  slug,
  domain,
  about,
  responseCount,
  responseGoal,
}: {
  slug: string;
  domain: string;
  about: string | null;
  responseCount: number;
  responseGoal: number;
}) {
  const [stage, setStage] = useState<"landing" | "flow" | "done">("landing");
  // Bumping this remounts FlowScreen with a fresh answer set ("Share another").
  const [runKey, setRunKey] = useState(0);
  const steps = useMemo(() => surveySteps(domain), [domain]);

  const submit = async (answers: FlowAnswers): Promise<string | null> => {
    const name = String(answers.name ?? "").trim();
    const email = String(answers.email ?? "").trim();
    const phone = String(answers.phone ?? "").trim();
    const standpoint = Array.isArray(answers.experience) ? answers.experience : [];
    const salience =
      typeof answers.salience === "string" && answers.salience
        ? Number(answers.salience)
        : null;

    const res = await fetch(`/api/surveys/${slug}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        observation: String(answers.observation ?? "").trim(),
        consent_participation: true, // the gated final step guarantees this
        standpoint,
        salience,
        prior_attempts: String(answers.prior_attempts ?? "").trim(),
        contactable: Boolean(name || email || phone),
        mentor_interest: answers.mentor === "yes",
        submitter_name: name,
        submitter_email: email,
        submitter_phone: phone,
      }),
    }).catch(() => null);

    const json = res ? await res.json().catch(() => null) : null;
    if (res?.ok) {
      setStage("done");
      return null;
    }
    return json?.error || "Something went wrong — try again.";
  };

  if (stage === "landing") {
    return (
      <Landing
        domain={domain}
        about={about}
        count={responseCount}
        goal={responseGoal}
        onBegin={() => setStage("flow")}
      />
    );
  }

  if (stage === "done") {
    return (
      <Done
        domain={domain}
        onAnother={() => {
          setRunKey((k) => k + 1);
          setStage("flow");
        }}
      />
    );
  }

  return (
    <FlowScreen
      key={runKey}
      eyebrow="Field survey"
      steps={steps}
      finalLabel="Submit observation"
      submittingLabel="Submitting…"
      onComplete={submit}
      onExit={() => setStage("landing")}
    />
  );
}

/* ── Landing — the full-width, responsive AIDA entry that fronts the flow.
   A scrolling content page (NOT the .onboard sheet, which locks scroll):
   Attention hero (+ live counter) → Interest → Desire → Action, then Begin
   drops into the one-question flow. Copy is DRAFT (owner-approvable, ported
   from the prototype byte-for-byte per DESIGN_INTENT §1). ── */
function Landing({
  domain,
  about,
  count,
  goal,
  onBegin,
}: {
  domain: string;
  about: string | null;
  count: number;
  goal: number;
  onBegin: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Attention — full-bleed hero */}
      <section className="s-cover grain on-dark landing-hero">
        <span className="landing-orb" aria-hidden>
          <Orb />
        </span>
        <div className="landing-scrim" aria-hidden />
        <div className="container landing-hero-inner">
          <div className="landing-col">
            <div className="lbl" style={{ marginBottom: 28 }}>
              The Upskilling Labs
            </div>
            <div className="lbl lbl-teal" style={{ marginBottom: 16 }}>
              Field survey · {domain}
            </div>
            <h1 className="t-display" style={{ marginBottom: 18 }}>
              You see something the data misses.
            </h1>
            <p className="t-lede" style={{ marginBottom: 4, maxWidth: "40ch" }}>
              {about ??
                `You live in a field. You notice what's stuck, what's broken, what keeps coming back. Tell us — that's where the next ${domain} Build Cycle begins.`}
            </p>
            <GoalCounter count={count} goal={goal} />
            <button
              className="btn btn-red btn-lg landing-cta"
              onClick={onBegin}
            >
              Share what you&rsquo;re seeing →
            </button>
            <p className="t-small" style={{ marginTop: 16 }}>
              ~2 minutes · no account needed · anonymous by default
            </p>
          </div>
        </div>
      </section>

      {/* Interest — why an observation matters */}
      <section className="section s-white">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 12 }}>
            Why it matters
          </div>
          <h2 className="t-h2" style={{ marginBottom: 16 }}>
            The best projects start with what someone noticed.
          </h2>
          <p className="t-lede" style={{ margin: 0 }}>
            Not a report. Not a headline. A person who was close enough to see
            what wasn&rsquo;t working. Your observation is that starting point —
            weighed by who&rsquo;s speaking, and read by the people deciding what
            to build next.
          </p>
        </div>
      </section>

      {/* Desire — where it goes */}
      <section className="section s-white">
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="lbl lbl-teal" style={{ marginBottom: 12 }}>
            Where it goes
          </div>
          <h2 className="t-h2" style={{ marginBottom: 24 }}>
            Your observation joins an open commons.
          </h2>
          <div className="cards two">
            <div className="lcard" style={{ padding: 24 }}>
              <h3 className="t-h4" style={{ marginBottom: 6 }}>
                Open by default
              </h3>
              <p className="t-body text-meta" style={{ margin: 0 }}>
                Everything built from these observations is open-source — free
                for anyone to use, including you.
              </p>
            </div>
            <div className="lcard" style={{ padding: 24 }}>
              <h3 className="t-h4" style={{ marginBottom: 6 }}>
                One of {goal.toLocaleString()}
              </h3>
              <p className="t-body text-meta" style={{ margin: 0 }}>
                We&rsquo;re gathering {goal.toLocaleString()} field observations
                to choose the problems this cycle takes on. Add yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Action — the closing ask */}
      <section
        className="s-cover grain on-dark"
        style={{ padding: "72px 0", textAlign: "center" }}
      >
        <div className="container" style={{ maxWidth: 640 }}>
          <h2 className="t-h2" style={{ marginBottom: 22 }}>
            Tell us what you&rsquo;re seeing.
          </h2>
          <button
            className="btn btn-red btn-lg landing-cta"
            onClick={onBegin}
          >
            Share your observation →
          </button>
          <p className="t-small" style={{ marginTop: 16 }}>
            Voluntary and anonymous. Answer only what you want.
          </p>
        </div>
      </section>
    </div>
  );
}

/* The live count toward the campaign goal — real number, no baseline. */
function GoalCounter({ count, goal }: { count: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const reached = count >= goal;
  const label = reached
    ? `Goal reached — ${count.toLocaleString()} and counting`
    : count === 0
      ? "Be one of the first"
      : `of ${goal.toLocaleString()} observations`;

  return (
    <div className="landing-goal">
      <span
        className="lbl lbl-teal"
        style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <span className="live-dot" aria-hidden />
        Live count
      </span>
      <div className="t-stat tabular-nums" style={{ marginTop: 8 }}>
        {count.toLocaleString()}
      </div>
      <div className="lbl" style={{ marginTop: 4 }}>
        {label}
      </div>
      <div
        className="goal-bar"
        role="progressbar"
        aria-valuenow={Math.min(count, goal)}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-label={`${count} of ${goal} observations collected`}
      >
        <div className="goal-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Done — the ✓ confirmation + the invitation to join ── */
function Done({
  domain,
  onAnother,
}: {
  domain: string;
  onAnother: () => void;
}) {
  return (
    <div className="view light onboard s-paper">
      <div className="sheet">
        <div className="topbar" />
        <div className="vscroll pad" style={{ paddingTop: 8 }}>
          <div className="media m-teal" style={{ marginBottom: 24 }}>
            <span className="m-tag">Received ✓</span>
            <Orb />
          </div>
          <div className="lbl lbl-teal" style={{ marginBottom: 14 }}>
            Thank you
          </div>
          <h1 className="t-h1" style={{ marginBottom: 14 }}>
            Your observation is in ✓
          </h1>
          <p className="t-lede" style={{ marginBottom: 28 }}>
            It joins the {domain} insights repository that Upskillers draw on as
            they form the problems worth tackling.
          </p>

          <div className="survey-join">
            <div className="lbl lbl-teal" style={{ marginBottom: 10 }}>
              Your turn
            </div>
            <h2 className="t-h3" style={{ marginBottom: 8 }}>
              Find your people. Build your edge.
            </h2>
            <p className="t-body text-meta" style={{ margin: 0 }}>
              The Upskilling Labs is free to join and runs in the open. Get an
              account and take part in the next Build Cycle — from understanding
              a problem to shipping a real solution.
            </p>
          </div>
        </div>
        <div className="actionbar light-bar">
          <Link className="btn btn-teal btn-lg btn-block" href="/login">
            Join The Labs →
          </Link>
          <button className="btn btn-link" onClick={onAnother}>
            Share another observation
          </button>
        </div>
      </div>
    </div>
  );
}
