"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FlowScreen,
  type FlowStep,
  type FlowAnswers,
} from "@/app/components/flow/flow-screen";
import type { SurveyQuestion } from "@/lib/content/surveys";

/* The field survey as a one-question-at-a-time flow (SENSEMAKING_FLOW.md §3),
   on the shared FlowScreen engine — the same shell as registration + the cycle
   ceremony. Full-bleed (the (survey) group has no nav/footer). A branded welcome
   cover → the questions → a ✓ confirmation.

   Since the question builder (migration 00061) the questions are data-driven:
   the server passes the survey's `survey_questions` rows and `questionsToFlowSteps`
   maps each to a FlowStep. The flow posts the raw answer map to
   /api/surveys/[slug]/responses, which resolves it against the same questions. */

/** Map a builder-defined question to the flow engine's FlowStep shape. Also
    used by the admin builder's live preview. */
export function questionsToFlowSteps(questions: SurveyQuestion[]): FlowStep[] {
  return questions.map(questionToFlowStep);
}

function questionToFlowStep(q: SurveyQuestion): FlowStep {
  const help = q.help ?? undefined;
  switch (q.question_type) {
    case "short_text":
      return { id: q.question_key, type: "text", q: q.prompt, help, ph: q.placeholder ?? undefined, required: q.required };
    case "long_text":
      return { id: q.question_key, type: "textarea", q: q.prompt, help, ph: q.placeholder ?? undefined, required: q.required };
    case "single_select":
      return { id: q.question_key, type: "choice", q: q.prompt, help, options: q.config.options ?? [] };
    case "yes_no":
      return {
        id: q.question_key,
        type: "choice",
        q: q.prompt,
        help,
        options: q.config.options ?? [
          { v: "yes", label: "Yes" },
          { v: "no", label: "No" },
        ],
      };
    case "multi_select":
      return {
        id: q.question_key,
        type: "multiselect",
        q: q.prompt,
        help,
        options: q.config.options ?? [],
        min: q.required ? Math.max(1, q.config.min ?? 1) : q.config.min ?? 0,
      };
    case "scale":
      return {
        id: q.question_key,
        type: "scale",
        q: q.prompt,
        help,
        lowLabel: q.config.lowLabel ?? "",
        highLabel: q.config.highLabel ?? "",
        optional: !q.required,
      };
    case "consent":
      return {
        id: q.question_key,
        type: "consent",
        q: q.prompt,
        agreementTitle: q.config.agreementTitle ?? "",
        agreement: q.config.agreement ?? [],
        references: q.config.references,
        text: q.config.text ?? "",
      };
    case "contact":
      return {
        id: q.question_key,
        type: "fields",
        q: q.prompt,
        help,
        fields: (q.config.fields ?? []).map((f) => ({
          id: f.id,
          label: f.label,
          ph: f.ph ?? "",
          required: false,
          half: f.half,
        })),
      };
  }
}

export default function SurveyFlow({
  slug,
  domain,
  about,
  responseCount,
  responseGoal,
  questions,
  isMember = false,
}: {
  slug: string;
  domain: string;
  about: string | null;
  responseCount: number;
  responseGoal: number;
  questions: SurveyQuestion[];
  isMember?: boolean;
}) {
  const [stage, setStage] = useState<"landing" | "flow" | "done">("landing");
  // Bumping this remounts FlowScreen with a fresh answer set ("Share another").
  const [runKey, setRunKey] = useState(0);
  const steps = useMemo(() => questionsToFlowSteps(questions), [questions]);

  const submit = async (answers: FlowAnswers): Promise<string | null> => {
    const res = await fetch(`/api/surveys/${slug}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
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
        isMember={isMember}
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

/* ── Done — the ✓ confirmation. Anonymous visitors get the "Join The Labs"
   invitation; signed-in members (arriving from the dashboard's first CTA) get
   a route back to their portal and a nudge to distribute the survey. ── */
function Done({
  domain,
  isMember,
  onAnother,
}: {
  domain: string;
  isMember: boolean;
  onAnother: () => void;
}) {
  return (
    <div className="view light onboard s-paper">
      <div className="sheet">
        <div className="topbar" />
        <div className="vscroll pad" style={{ paddingTop: 8 }}>
          <div className="media" style={{ marginBottom: 24 }}>
            <span className="m-tag">Received ✓</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/orb-mark.png"
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
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
              {isMember ? "Keep it going" : "Your turn"}
            </div>
            <h2 className="t-h3" style={{ marginBottom: 8 }}>
              {isMember
                ? "Spread the survey through your field."
                : "Find your people. Build your edge."}
            </h2>
            <p className="t-body text-meta" style={{ margin: 0 }}>
              {isMember
                ? "The strongest cycles start with the widest net. Share this survey with people close to the problem — the more field observations, the sharper the problems your cohort picks."
                : "The Upskilling Labs is free to join and runs in the open. Get an account and take part in the next Build Cycle — from understanding a problem to shipping a real solution."}
            </p>
          </div>
        </div>
        <div className="actionbar light-bar">
          {isMember ? (
            <Link className="btn btn-teal btn-lg btn-block" href="/dashboard">
              Back to your dashboard →
            </Link>
          ) : (
            <Link className="btn btn-teal btn-lg btn-block" href="/login?intent=join">
              Join The Labs →
            </Link>
          )}
          <button className="btn btn-link" onClick={onAnother}>
            Share another observation
          </button>
        </div>
      </div>
    </div>
  );
}
