"use client";

import { useState } from "react";

const IMPACT_TRACKS = [
  "Workforce & Economic Mobility",
  "Civic Infrastructure & Public Services",
  "Small Business & Entrepreneurship",
  "Education & Skills",
  "Health & Community Wellbeing",
  "Technology & Digital Access",
];

type Step = 1 | 2 | 3 | 4 | 5 | 6;

export default function ProposeForm({
  cycleId,
  participantName,
}: {
  cycleId: number;
  participantName: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Part 1 — About You
  const [name, setName] = useState(participantName);
  const [background, setBackground] = useState("");
  const [experience, setExperience] = useState<
    "lived" | "witnessed" | "both" | ""
  >("");

  // Part 2 — The Problem
  const [who, setWho] = useState("");
  const [need, setNeed] = useState("");
  const [barrier, setBarrier] = useState("");
  const [success, setSuccess] = useState("");

  // Part 3 — Your Problem Statement
  const [statementText, setStatementText] = useState("");
  const [question, setQuestion] = useState("");

  // Part 4 — Where This Problem Lives
  const [impactTrack, setImpactTrack] = useState("");
  const [impactTrackOther, setImpactTrackOther] = useState("");
  const [themeAlignment, setThemeAlignment] = useState<
    "none" | "direct" | "adjacent"
  >("none");
  const [themeConnection, setThemeConnection] = useState("");

  // Part 5 — Context for Voters
  const [tried, setTried] = useState("");
  const [scale, setScale] = useState("");
  const [podWork, setPodWork] = useState("");
  const [skillsNeeded, setSkillsNeeded] = useState("");

  // Part 6 — Checklist
  const [checkRealPerson, setCheckRealPerson] = useState(false);
  const [checkAction, setCheckAction] = useState(false);
  const [checkNoSolution, setCheckNoSolution] = useState(false);
  const [checkSpecific, setCheckSpecific] = useState(false);
  const [checkSamePicture, setCheckSamePicture] = useState(false);

  const allChecked =
    checkRealPerson &&
    checkAction &&
    checkNoSolution &&
    checkSpecific &&
    checkSamePicture;

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return !!name.trim();
      case 2:
        return (
          !!who.trim() &&
          !!need.trim() &&
          !!barrier.trim() &&
          !!success.trim()
        );
      case 3:
        return !!statementText.trim() && !!question.trim();
      case 4:
        return true; // optional
      case 5:
        return true; // optional but valuable
      case 6:
        return allChecked;
      default:
        return false;
    }
  }

  async function handleSubmit() {
    setError("");
    setSubmitting(true);

    const resolvedTrack =
      impactTrack === "Other" ? impactTrackOther : impactTrack;

    try {
      const res = await fetch("/api/problem-statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_id: cycleId,
          statement_text: statementText.trim(),
          proposal_data: {
            about: {
              background: background.trim() || undefined,
              experience: experience || undefined,
            },
            problem: {
              who: who.trim(),
              need: need.trim(),
              barrier: barrier.trim(),
              success: success.trim(),
            },
            statement: {
              text: statementText.trim(),
              question: question.trim(),
            },
            context: {
              impact_track: resolvedTrack || undefined,
              theme_alignment:
                themeAlignment !== "none" ? themeAlignment : undefined,
              theme_connection: themeConnection.trim() || undefined,
            },
            voter_context: {
              tried: tried.trim() || undefined,
              scale: scale.trim() || undefined,
              pod_work: podWork.trim() || undefined,
              skills_needed: skillsNeeded.trim() || undefined,
            },
            checklist: {
              real_person: checkRealPerson,
              action_not_thing: checkAction,
              no_solution: checkNoSolution,
              specific_outcome: checkSpecific,
              same_picture: checkSamePicture,
            },
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to submit");
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-md border border-teal/30 bg-teal/[0.04] p-8 text-center">
        <h2 className="text-xl font-bold text-white">Proposal Submitted</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-cloud/60">
          Your proposal enters the Open Cycle queue. At the start of each Cycle,
          active participants vote during Phase 1 to build a shortlist. If your
          proposal makes the shortlist, it opens for registration. Research Pods
          that reach the minimum number of registrants officially form and begin
          work. You&rsquo;ll be notified at each stage.
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setStep(1);
            setBackground("");
            setExperience("");
            setWho("");
            setNeed("");
            setBarrier("");
            setSuccess("");
            setStatementText("");
            setQuestion("");
            setImpactTrack("");
            setImpactTrackOther("");
            setThemeAlignment("none");
            setThemeConnection("");
            setTried("");
            setScale("");
            setPodWork("");
            setSkillsNeeded("");
            setCheckRealPerson(false);
            setCheckAction(false);
            setCheckNoSolution(false);
            setCheckSpecific(false);
            setCheckSamePicture(false);
          }}
          className="mt-6 rounded-md bg-teal/20 px-4 py-2 text-sm font-medium text-aqua transition-colors hover:bg-teal/30"
        >
          Submit another proposal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {([1, 2, 3, 4, 5, 6] as Step[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              if (s < step) setStep(s);
            }}
            className={`h-2 flex-1 rounded-full transition-colors ${
              s === step
                ? "bg-aqua"
                : s < step
                  ? "bg-teal/60 hover:bg-teal/80"
                  : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* PART 1 */}
      {step === 1 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Part 1 — About You
            </h2>
          </div>

          <Field label="Your name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Your background in one sentence" hint="What you do or have done — helps voters understand where this problem comes from.">
            <input
              type="text"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              maxLength={500}
              className={inputClass}
            />
          </Field>

          <Field label="Have you personally experienced this problem, or are you bringing it on behalf of others you know?">
            <div className="space-y-2">
              {(
                [
                  ["lived", "I've lived it directly"],
                  ["witnessed", "I've witnessed it in people I've worked with"],
                  ["both", "Both"],
                ] as const
              ).map(([val, label]) => (
                <label
                  key={val}
                  className="flex cursor-pointer items-center gap-2 text-sm text-cloud/70"
                >
                  <input
                    type="radio"
                    name="experience"
                    value={val}
                    checked={experience === val}
                    onChange={() => setExperience(val)}
                    className="accent-teal"
                  />
                  {label}
                </label>
              ))}
            </div>
          </Field>
        </section>
      )}

      {/* PART 2 */}
      {step === 2 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Part 2 — The Problem
            </h2>
            <p className="mt-1 text-sm text-cloud/50">
              This is the core of your proposal. Answer all four prompts
              carefully.
            </p>
          </div>

          <Field
            label="2a. Who is struggling with this problem?"
            hint={"Describe the person \u2014 not a category or institution. Include what they\u2019re doing, what they\u2019re up against, or how they\u2019re feeling."}
            example={"Not: \u201Csmall business owners.\u201D Better: \u201Ca food truck operator in Southeast DC who built her business without a formal financial background and is now trying to figure out whether she qualifies for a city contract.\u201D"}
            required
          >
            <textarea
              value={who}
              onChange={(e) => setWho(e.target.value)}
              maxLength={2000}
              rows={4}
              className={textareaClass}
            />
            <CharCount value={who} max={2000} />
          </Field>

          <Field
            label="2b. What do they need to be able to do?"
            hint={"Express this as an action \u2014 something they\u2019re trying to accomplish, not something they\u2019re trying to acquire."}
            example={"Not: \u201Cthey need better resources.\u201D Better: \u201Cthey need to navigate the city\u2019s procurement process without having to hire someone to explain it to them.\u201D"}
            required
          >
            <textarea
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              maxLength={2000}
              rows={4}
              className={textareaClass}
            />
            <CharCount value={need} max={2000} />
          </Field>

          <Field
            label={"2c. Why can\u2019t they do it right now?"}
            hint={"This is your insight. What\u2019s actually in the way \u2014 not the obvious answer, but the real one?"}
            example={"Not: \u201Cbecause the process is complicated.\u201D Better: \u201Cbecause the application assumes you already have a DUNS number and a registered business entity, and no one explains that until after you\u2019ve spent three hours filling out the form.\u201D"}
            required
          >
            <textarea
              value={barrier}
              onChange={(e) => setBarrier(e.target.value)}
              maxLength={2000}
              rows={4}
              className={textareaClass}
            />
            <CharCount value={barrier} max={2000} />
          </Field>

          <Field
            label="2d. What does success actually look like for this person?"
            hint={"Describe the specific outcome \u2014 what changes in their life or work when this problem is solved. Avoid vague words like \u201Cbetter\u201D or \u201Cimproved.\u201D"}
            example={"Not: \u201Cthey feel more empowered.\u201D Better: \u201Cshe submits a complete procurement application on her own and makes it to the review stage for the first time.\u201D"}
            required
          >
            <textarea
              value={success}
              onChange={(e) => setSuccess(e.target.value)}
              maxLength={2000}
              rows={4}
              className={textareaClass}
            />
            <CharCount value={success} max={2000} />
          </Field>
        </section>
      )}

      {/* PART 3 */}
      {step === 3 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Part 3 — Your Problem Statement
            </h2>
            <p className="mt-1 text-sm text-cloud/50">
              Using your answers above, assemble your statement in one sentence.
            </p>
          </div>

          <div className="rounded-md border border-white/10 bg-white/[0.02] p-4 text-sm text-cloud/50">
            <p className="font-medium text-cloud/70">Template:</p>
            <p className="mt-1 italic">
              [Who is struggling] needs to [what they need to do] because [why
              they can&rsquo;t right now].
            </p>
          </div>

          <Field label="Your problem statement" required>
            <textarea
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="[Who] needs to [what] because [why]..."
              className={textareaClass}
            />
            <CharCount value={statementText} max={2000} />
          </Field>

          <div className="rounded-md border border-white/10 bg-white/[0.02] p-4 text-sm text-cloud/50">
            <p className="font-medium text-cloud/70">
              Now reframe it as a question your Research Pod would work to
              answer:
            </p>
            <p className="mt-1 italic">
              How might we [action] for [who] so that [the outcome from 2d]?
            </p>
          </div>

          <Field label="Your question" required>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="How might we..."
              className={textareaClass}
            />
            <CharCount value={question} max={2000} />
          </Field>
        </section>
      )}

      {/* PART 4 */}
      {step === 4 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Part 4 — Where This Problem Lives
            </h2>
            <p className="mt-1 text-sm text-cloud/50">
              These fields help us connect your Pod to the right mentors and
              advisors. Skip this section if your problem doesn&rsquo;t fit
              neatly — it won&rsquo;t affect your proposal.
            </p>
          </div>

          <Field label="Impact Track" hint="If your problem maps to one of these, select it. If it cuts across more than one, pick the primary.">
            <div className="space-y-2">
              {IMPACT_TRACKS.map((track) => (
                <label
                  key={track}
                  className="flex cursor-pointer items-center gap-2 text-sm text-cloud/70"
                >
                  <input
                    type="radio"
                    name="impact_track"
                    value={track}
                    checked={impactTrack === track}
                    onChange={() => setImpactTrack(track)}
                    className="accent-teal"
                  />
                  {track}
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-cloud/70">
                <input
                  type="radio"
                  name="impact_track"
                  value="Other"
                  checked={impactTrack === "Other"}
                  onChange={() => setImpactTrack("Other")}
                  className="accent-teal"
                />
                Other
              </label>
              {impactTrack === "Other" && (
                <input
                  type="text"
                  value={impactTrackOther}
                  onChange={(e) => setImpactTrackOther(e.target.value)}
                  placeholder="Specify..."
                  className={`ml-6 ${inputClass}`}
                />
              )}
            </div>
          </Field>

          <Field label="Cycle Theme Alignment" hint="Each Cycle recruits mentors and advisors around a specific industry theme. If your problem connects to the current theme, note it here.">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-cloud/70">
                <input
                  type="radio"
                  name="theme"
                  checked={themeAlignment === "none"}
                  onChange={() => setThemeAlignment("none")}
                  className="accent-teal"
                />
                No particular connection
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-cloud/70">
                <input
                  type="radio"
                  name="theme"
                  checked={themeAlignment === "direct"}
                  onChange={() => setThemeAlignment("direct")}
                  className="accent-teal"
                />
                My problem sits directly inside this theme
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-cloud/70">
                <input
                  type="radio"
                  name="theme"
                  checked={themeAlignment === "adjacent"}
                  onChange={() => setThemeAlignment("adjacent")}
                  className="accent-teal"
                />
                My problem touches this theme from an adjacent angle
              </label>
            </div>
            {themeAlignment !== "none" && (
              <textarea
                value={themeConnection}
                onChange={(e) => setThemeConnection(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Describe the connection briefly..."
                className={`mt-3 ${textareaClass}`}
              />
            )}
          </Field>
        </section>
      )}

      {/* PART 5 */}
      {step === 5 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Part 5 — Context for Voters
            </h2>
            <p className="mt-1 text-sm text-cloud/50">
              This section is read by active Cycle participants during the
              voting window. Give them enough to make a real decision — about
              whether the problem matters and whether they want to work on it.
            </p>
          </div>

          <Field
            label="What has already been tried?"
            hint={"Programs, tools, workarounds \u2014 even if they partially work. \u201CNothing I know of\u201D is a valid answer."}
          >
            <textarea
              value={tried}
              onChange={(e) => setTried(e.target.value)}
              maxLength={2000}
              rows={3}
              className={textareaClass}
            />
          </Field>

          <Field
            label="Why does this problem matter beyond the individual?"
            hint={"Who else is affected \u2014 a neighborhood, a sector, a workforce? What\u2019s the scale?"}
          >
            <textarea
              value={scale}
              onChange={(e) => setScale(e.target.value)}
              maxLength={2000}
              rows={3}
              className={textareaClass}
            />
          </Field>

          <Field
            label="What would this Research Pod actually do together?"
            hint="A pilot, a toolkit, a guide, a mapped process, a prototype — give voters a picture of the work, even a rough one."
          >
            <textarea
              value={podWork}
              onChange={(e) => setPodWork(e.target.value)}
              maxLength={2000}
              rows={3}
              className={textareaClass}
            />
          </Field>

          <Field
            label="What kinds of people or skills would make this Research Pod stronger?"
            hint={"Be specific \u2014 \u201Csomeone who has worked in city government,\u201D \u201Ca designer,\u201D \u201Csomeone who has used this system themselves.\u201D"}
          >
            <textarea
              value={skillsNeeded}
              onChange={(e) => setSkillsNeeded(e.target.value)}
              maxLength={2000}
              rows={3}
              className={textareaClass}
            />
          </Field>
        </section>
      )}

      {/* PART 6 */}
      {step === 6 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Part 6 — Before You Submit
            </h2>
            <p className="mt-1 text-sm text-cloud/50">
              Read your problem statement one more time. Check each box
              honestly.
            </p>
          </div>

          <div className="rounded-md border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm italic text-cloud/70">
              &ldquo;{statementText}&rdquo;
            </p>
          </div>

          <div className="space-y-3">
            <CheckItem
              checked={checkRealPerson}
              onChange={setCheckRealPerson}
              label="The problem describes a real person, not an institution or a system"
            />
            <CheckItem
              checked={checkAction}
              onChange={setCheckAction}
              label="The need is something to do, not something to have"
            />
            <CheckItem
              checked={checkNoSolution}
              onChange={setCheckNoSolution}
              label="The statement contains no solution — just the problem"
            />
            <CheckItem
              checked={checkSpecific}
              onChange={setCheckSpecific}
              label={"The outcome in 2d is specific enough that you\u2019d know when you\u2019d reached it"}
            />
            <CheckItem
              checked={checkSamePicture}
              onChange={setCheckSamePicture}
              label="Two strangers reading this would picture the same situation"
            />
          </div>

          {!allChecked && (
            <p className="text-sm text-cloud/40">
              If any box is unchecked, revise before submitting. A sharper
              proposal earns more votes.
            </p>
          )}
        </section>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-whisper pt-6">
        <div>
          {step > 1 && (
            <button
              onClick={() => setStep((step - 1) as Step)}
              className="rounded-md bg-white/[0.06] px-4 py-2 text-sm font-medium text-cloud/70 transition-colors hover:bg-white/[0.1]"
            >
              &larr; Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-cloud/40">Part {step} of 6</span>
          {step < 6 ? (
            <button
              onClick={() => setStep((step + 1) as Step)}
              disabled={!canAdvance()}
              className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-midnight transition-colors hover:bg-aqua disabled:opacity-50"
            >
              Continue &rarr;
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !allChecked}
              className="rounded-md bg-teal px-5 py-2 text-sm font-medium text-midnight transition-colors hover:bg-aqua disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Proposal"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared helpers ──────────────────────────────────────────────── */

const inputClass =
  "w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-white placeholder:text-cloud/30 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";

const textareaClass =
  "w-full rounded-md border border-whisper bg-white/[0.04] px-3 py-2 text-white placeholder:text-cloud/30 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal";

function Field({
  label,
  hint,
  example,
  required,
  children,
}: {
  label: string;
  hint?: string;
  example?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-cloud/70">
        {label}
        {required && <span className="ml-0.5 text-aqua">*</span>}
      </label>
      {hint && <p className="mb-2 text-xs leading-relaxed text-cloud/40">{hint}</p>}
      {example && (
        <p className="mb-3 rounded border border-white/5 bg-white/[0.02] px-3 py-2 text-xs italic leading-relaxed text-cloud/35">
          {example}
        </p>
      )}
      {children}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="mt-1 text-xs text-cloud/40">
      {value.length}/{max}
    </p>
  );
}

function CheckItem({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm text-cloud/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-teal"
      />
      {label}
    </label>
  );
}
