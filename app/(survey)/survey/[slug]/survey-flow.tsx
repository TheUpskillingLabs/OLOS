"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FlowScreen,
  type FlowStep,
  type FlowAnswers,
} from "@/app/components/flow/flow-screen";
import { EdSection, EdRow, Pull } from "@/app/components/chrome/editorial";
import type { SurveyQuestion } from "@/lib/content/surveys";

/* The Build Cycle's five stages, as a real sequence — rendered on the
   standards-manual numbered-process pattern (.ed-steps). */
const BUILD_CYCLE_STEPS: [string, string][] = [
  ["Learn", "Get up to speed on the theme and the tools, together."],
  ["Understand", "Dig into the problem as a community until you can see it clearly."],
  ["Ideate", "Turn what you've learned into solutions worth building."],
  ["Prototype", "Iterate on real prototypes in small teams."],
  ["Showcase", "Present your MVP in a public showcase."],
];

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
   A scrolling content page (NOT the .onboard sheet, which locks scroll),
   built as a clean Attention → Interest → Desire → Action arc:
     A  hero — who you are, what you see, one clear ask (+ live counter)
     I  why one person's observation is the real starting point
     D  where it goes — an open commons, one of {goal}
     A  the closing ask, left-aligned to match the hero and the brand
   Begin drops into the one-question flow. Copy is owner-approvable draft,
   in the Red Antler / benefit-led register (DESIGN_INTENT §1). ── */
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
          <div className="landing-masthead">
            <div className="lbl" style={{ marginBottom: 18 }}>
              The Upskilling Labs
            </div>
            <h1 className="survey-title" style={{ marginBottom: 14 }}>
              <span>Field</span>
              <span>Survey</span>
            </h1>
            <div className="t-h2" style={{ color: "var(--teal)" }}>
              {domain} Edition
            </div>
            <div className="landing-rule" aria-hidden />
          </div>
          <div className="landing-support">
            <p className="t-lede" style={{ marginBottom: 4, maxWidth: "42ch" }}>
              {about ??
                `You see what the data misses. You know what keeps breaking, what's stuck, what nobody has fixed. Tell us what you're seeing, and a team at The Upskilling Labs builds from it in the next ${domain} Build Cycle.`}
            </p>
            <GoalCounter count={count} goal={goal} />
            <button
              className="btn btn-red btn-lg landing-cta"
              onClick={onBegin}
            >
              Share what you&rsquo;re seeing →
            </button>
            <p className="t-small" style={{ marginTop: 16 }}>
              ~2 minutes
            </p>
          </div>
        </div>
      </section>

      {/* Body — recomposed on the editorial "standards-manual" grid (ref: 1976
          NASA Graphics Standards Manual), matching /about and /build-cycles:
          each section's eyebrow owns column 1, the heading spans columns 2–5,
          and content flows in the rows beneath, divided by heavy modernist
          rules on the 8px baseline. */}
      <div className="container" style={{ paddingTop: 88, paddingBottom: 72 }}>
        <div className="ed-doc">
          {/* Interest — why observations matter */}
          <EdSection
            eyebrow="Why it matters"
            heading="Observations from the people closest to a problem are where the best projects begin."
          >
            <EdRow>
              <p className="t-lede ed-text">
                The Upskilling Labs collects observations from workers,
                researchers, community members, and the general public to
                identify the problems worth tackling in each Build Cycle.
              </p>
            </EdRow>
          </EdSection>

          {/* About the Labs */}
          <EdSection
            eyebrow="About the Labs"
            heading="What is The Upskilling Labs?"
          >
            <EdRow>
              <div>
                <p className="t-lede ed-text" style={{ marginBottom: 16 }}>
                  Founded in January 2026, The Upskilling Labs is a free
                  workforce development and community organization that helps
                  professionals build not just AI literacy, but the skills and
                  capacity to identify problems, lead initiatives, and drive
                  real outcomes in the age of AI.
                </p>
                <p className="t-body ed-text" style={{ color: "var(--slate)" }}>
                  Based in Washington, DC and partnered with DC Public Library,
                  the Labs brings together workers, builders, and thinkers. The
                  Labs is a fiscally sponsored project of Superbloom Design, a
                  501(c)(3) nonprofit organization.
                </p>
              </div>
            </EdRow>
          </EdSection>

          {/* The Build Cycle — a real sequence, on the numbered-process pattern */}
          <EdSection
            eyebrow="The Build Cycle"
            heading="The flagship program is the quarterly Build Cycle."
          >
            <EdRow>
              <p className="t-lede ed-text">
                Each cycle centers on a different sector-based theme. Over three
                months, Upskillers move through five stages — using and learning
                emerging technologies like AI along the way.
              </p>
            </EdRow>
            <EdRow>
              <div className="ed-steps">
                {BUILD_CYCLE_STEPS.map(([label, blurb], i) => (
                  <div key={label}>
                    <div className="ed-step-n">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="ed-step-rule" />
                    <div className="lbl" style={{ marginBottom: 6 }}>
                      {label}
                    </div>
                    <p className="t-body" style={{ color: "var(--slate)" }}>
                      {blurb}
                    </p>
                  </div>
                ))}
              </div>
            </EdRow>
          </EdSection>

          {/* Desire — where your insights go */}
          <EdSection eyebrow="Where it goes" heading="Where do my insights go?">
            <EdRow>
              <p className="t-lede ed-text">
                Your insights help shape the very problems Upskillers choose to
                explore in our upcoming {domain} Build Cycle. As they form their
                problem frames, Upskillers draw on an insights repository —
                contributed by subject-matter experts, practitioners in the
                field, and members of the public.
              </p>
            </EdRow>
            <Pull>Everything Upskillers produce is accessible and open-source.</Pull>
          </EdSection>

          {/* Action — the closing ask */}
          <EdSection
            eyebrow="Ready when you are"
            heading="Tell us what you're seeing."
          >
            <EdRow>
              <div>
                <p className="t-lede ed-text" style={{ marginBottom: 24 }}>
                  One observation is enough to start. Add as many as you&rsquo;ve
                  got — every one reaches the Upskillers building the next{" "}
                  {domain} Build Cycle.
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <button className="btn btn-red btn-lg" onClick={onBegin}>
                    Share your observation →
                  </button>
                </div>
                <p
                  className="t-small"
                  style={{ marginTop: 16, color: "var(--meta)" }}
                >
                  Submissions are voluntary and anonymous unless you choose to
                  share your contact information.
                </p>
              </div>
            </EdRow>
          </EdSection>
        </div>
      </div>
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
