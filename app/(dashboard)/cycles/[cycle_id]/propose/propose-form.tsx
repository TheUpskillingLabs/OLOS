"use client";

import { useState } from "react";
import Link from "next/link";

// The wizard mirrors the Triangulator's Deepen workbook on purpose: steps 2–3
// ask for the exact fields the workbook made the submitter write (situation
// name/description/openness, then the paradox and its pressure-test), with the
// tool's own labels and placeholder grammar, so submitting is a paste — not a
// re-derivation into someone else's vocabulary. Step 1 leads with the map
// link because the room's flow arrives here straight from the Git handoff.
const STEP_NAMES = [
  "Your map & you",
  "The Problem Situation",
  "The paradox",
  "Distill it",
  "Context for voters",
  "Before you submit",
] as const;

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

  // Part 1 — Your map & you
  const [repoUrl, setRepoUrl] = useState("");
  const [name, setName] = useState(participantName);
  const [background, setBackground] = useState("");
  const [experience, setExperience] = useState<
    "lived" | "witnessed" | "both" | ""
  >("");

  // Part 2 — The Problem Situation (Triangulator workbook, Stage 1)
  const [sitTitle, setSitTitle] = useState("");
  const [sitDescription, setSitDescription] = useState("");
  const [sitOpenness, setSitOpenness] = useState("");

  // Part 3 — The paradox (workbook Stage 5)
  const [paradox, setParadox] = useState("");
  const [beneficiaries, setBeneficiaries] = useState("");
  const [problematization, setProblematization] = useState("");

  // Part 4 — The distilled statement + How-Might-We
  const [statementText, setStatementText] = useState("");
  const [question, setQuestion] = useState("");

  // Part 5 — Context for Voters (+ where this lives)
  const [tried, setTried] = useState("");
  const [scale, setScale] = useState("");
  const [podWork, setPodWork] = useState("");
  const [skillsNeeded, setSkillsNeeded] = useState("");
  const [impactTrack, setImpactTrack] = useState("");
  const [impactTrackOther, setImpactTrackOther] = useState("");
  const [themeAlignment, setThemeAlignment] = useState<
    "none" | "direct" | "adjacent"
  >("none");
  const [themeConnection, setThemeConnection] = useState("");

  // Part 6 — Checklist (the Triangulator's own rules)
  const [checkGrounded, setCheckGrounded] = useState(false);
  const [checkActors, setCheckActors] = useState(false);
  const [checkNoSolution, setCheckNoSolution] = useState(false);
  const [checkParadox, setCheckParadox] = useState(false);
  const [checkSamePicture, setCheckSamePicture] = useState(false);

  const allChecked =
    checkGrounded &&
    checkActors &&
    checkNoSolution &&
    checkParadox &&
    checkSamePicture;

  // Accept bare "github.com/org/repo" pastes by prefixing https://. Gating
  // Continue on parseability here matters: the server's Zod rejection would
  // otherwise only surface after step 6.
  const normalizedRepoUrl = (() => {
    const raw = repoUrl.trim();
    if (!raw) return "";
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  })();
  const repoUrlValid = (() => {
    if (!normalizedRepoUrl) return true;
    if (normalizedRepoUrl.length > 500) return false;
    try {
      new URL(normalizedRepoUrl);
      return true;
    } catch {
      return false;
    }
  })();

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return !!name.trim() && repoUrlValid;
      case 2:
        return (
          !!sitTitle.trim() && !!sitDescription.trim() && !!sitOpenness.trim()
        );
      case 3:
        return !!paradox.trim();
      case 4:
        return !!statementText.trim() && !!question.trim();
      case 5:
        return true; // optional but valuable
      case 6:
        return allChecked;
      default:
        return false;
    }
  }

  // Step changes reset the scroll position — the nav buttons sit at the
  // bottom of a long step, so without this the next (often shorter) step
  // renders with the viewport still parked at the footer.
  function goToStep(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0 });
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
            situation: {
              title: sitTitle.trim(),
              description: sitDescription.trim(),
              openness: sitOpenness.trim(),
              paradox: paradox.trim(),
              beneficiaries: beneficiaries.trim() || undefined,
              problematization: problematization.trim() || undefined,
            },
            statement: {
              text: statementText.trim(),
              question: question.trim(),
              repo_url: normalizedRepoUrl || undefined,
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
              grounded_in_evidence: checkGrounded,
              real_actors: checkActors,
              no_solution: checkNoSolution,
              paradox_self_undoing: checkParadox,
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
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-card border border-teal/30 bg-teal/10 p-8">
        <h2 className="t-h3 text-ink">
          Problem situation submitted
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-charcoal">
          Your problem situation is in. During the voting window, cycle
          participants read the gallery and allocate their votes; the
          top-voted situations become the cycle&rsquo;s pods, and pod
          registration opens after the shortlist is finalized. You&rsquo;ll be
          notified at each stage.
        </p>
        <blockquote className="mt-5 max-w-lg rounded-card border border-teal/30 bg-white p-4">
          <div className="lbl mb-2">Your problem situation</div>
          {sitTitle.trim() && (
            <p className="mb-1 text-sm font-semibold text-ink">
              {sitTitle.trim()}
            </p>
          )}
          <p className="text-sm leading-relaxed text-charcoal">
            {statementText.trim()}
          </p>
          {question.trim() && (
            <p className="mt-2 text-sm italic leading-relaxed text-meta">
              {question.trim()}
            </p>
          )}
        </blockquote>
        <Link
          href={`/cycles/${cycleId}/proposals`}
          className="mr-3 mt-6 inline-block rounded-card bg-teal-deep px-3 py-2 text-xs font-semibold tracking-tight text-white transition-colors duration-150 hover:bg-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          See it in the gallery
        </Link>
        <Link
          href={`/cycles/${cycleId}`}
          className="mr-3 mt-6 inline-block rounded-card border border-ink/15 px-3 py-2 text-xs font-semibold tracking-tight text-charcoal transition-colors duration-150 hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          Back to the cycle
        </Link>
        <button
          onClick={() => {
            setSubmitted(false);
            setStep(1);
            setRepoUrl("");
            setBackground("");
            setExperience("");
            setSitTitle("");
            setSitDescription("");
            setSitOpenness("");
            setParadox("");
            setBeneficiaries("");
            setProblematization("");
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
            setCheckGrounded(false);
            setCheckActors(false);
            setCheckNoSolution(false);
            setCheckParadox(false);
            setCheckSamePicture(false);
          }}
          className="mt-6 rounded-card bg-teal/10 px-3 py-2 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          Submit another problem situation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step indicator — design-system wizard pattern */}
      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-meta">
          <span className="tabular-nums">Step {step} of 6</span>
          <span className="font-medium text-charcoal">
            {STEP_NAMES[step - 1]}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-teal transition-all duration-500 ease-spring"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>
      </div>

      {/* PART 1 — the map link leads: the room arrives here from the Git
          handoff with the repo URL on their clipboard. */}
      {step === 1 && (
        <section className="space-y-6">
          <div>
            <h2 className="t-h3 text-ink">
              Part 1 — Your Map &amp; You
            </h2>
            <p className="mt-1 text-sm text-meta">
              Start with the map you just published — everything you submit
              here should be readable off it.
            </p>
          </div>

          <Field
            label="Link to your map"
            hint="The GitHub repo your triad shares (or a link straight to your folder in it). Voters open this to see the evidence behind your situation."
          >
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              maxLength={500}
              placeholder="https://github.com/..."
              className={inputClass}
            />
            {!repoUrlValid && (
              <p className="mt-1 text-xs text-red">
                That doesn&rsquo;t look like a URL — fix it or leave the field
                empty.
              </p>
            )}
          </Field>

          <Field label="Your name" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Your background in one sentence" hint="What you do or have done — helps voters understand where this situation comes from.">
            <input
              type="text"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              maxLength={500}
              className={inputClass}
            />
          </Field>

          <Field label="Have you personally experienced this situation, or are you bringing it on behalf of others you know?">
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
                  className="flex cursor-pointer items-center gap-2 text-sm text-charcoal transition-colors duration-150 hover:text-ink"
                >
                  <input
                    type="radio"
                    name="experience"
                    value={val}
                    checked={experience === val}
                    onChange={() => setExperience(val)}
                    className="h-4 w-4 accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                  />
                  {label}
                </label>
              ))}
            </div>
          </Field>
        </section>
      )}

      {/* PART 2 — the workbook's Stage 1 fields, same labels and grammar */}
      {step === 2 && (
        <section className="space-y-6">
          <div>
            <h2 className="t-h3 text-ink">
              Part 2 — The Problem Situation
            </h2>
            <p className="mt-1 text-sm text-meta">
              These are the same three fields you filled in the
              Triangulator&rsquo;s workbook (Stage 1) — bring them over in
              your own words.
            </p>
          </div>

          <Field
            label="Name the problem situation"
            hint="A short name for this open condition — the title on your situation box."
            required
          >
            <input
              type="text"
              value={sitTitle}
              onChange={(e) => setSitTitle(e.target.value)}
              maxLength={200}
              placeholder="A short name for this open condition"
              className={inputClass}
            />
          </Field>

          <Field
            label="Describe it — the open, complex, networked condition"
            required
          >
            <textarea
              value={sitDescription}
              onChange={(e) => setSitDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="This is an open condition, not a bounded problem, because ___"
              className={textareaClass}
            />
            <CharCount value={sitDescription} max={2000} />
          </Field>

          <Field
            label="What makes it open?"
            hint="Why this is a situation, not a task: the network of actors, the moving parts, the absence of a known path."
            required
          >
            <textarea
              value={sitOpenness}
              onChange={(e) => setSitOpenness(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="What makes this open: the network of actors, the moving parts, the absence of a known path…"
              className={textareaClass}
            />
            <CharCount value={sitOpenness} max={2000} />
          </Field>
        </section>
      )}

      {/* PART 3 — the workbook's Stage 5: the paradox is what the pod forms around */}
      {step === 3 && (
        <section className="space-y-6">
          <div>
            <h2 className="t-h3 text-ink">
              Part 3 — The Paradox
            </h2>
            <p className="mt-1 text-sm text-meta">
              Stage 5 of the workbook. The paradox is the self-undoing
              deadlock your pod forms around — X requires not-X, not a mere
              trade-off.
            </p>
          </div>

          <Field
            label="The paradox"
            required
          >
            <textarea
              value={paradox}
              onChange={(e) => setParadox(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="The situation demands ___, but the same conditions that create the need also prevent ___ from working."
              className={textareaClass}
            />
            <CharCount value={paradox} max={2000} />
          </Field>

          <Field
            label="Who benefits from its persistence?"
            hint="Name the actor and the mechanism — a paradox that benefits no one usually isn't one."
          >
            <textarea
              value={beneficiaries}
              onChange={(e) => setBeneficiaries(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Actor: ___. Mechanism: ___."
              className={textareaClass}
            />
          </Field>

          <Field
            label="Pressure-test"
            hint="The workbook's problematization pass — carry it over."
          >
            <textarea
              value={problematization}
              onChange={(e) => setProblematization(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What's assumed, what would break this, what you've chosen not to see. Your words."
              className={textareaClass}
            />
          </Field>
        </section>
      )}

      {/* PART 4 — the one-sentence distillation OLOS asks for */}
      {step === 4 && (
        <section className="space-y-6">
          <div>
            <h2 className="t-h3 text-ink">
              Part 4 — Distill It
            </h2>
            <p className="mt-1 text-sm text-meta">
              The gallery and the ballot lead with one sentence. Distill the
              situation so a stranger pictures it — the map holds the depth.
            </p>
          </div>

          <div className="rounded-card border border-ink/10 bg-white p-4 text-sm text-slate">
            <p className="font-semibold text-charcoal">Template:</p>
            <p className="mt-1 italic">
              [Who, specifically] needs to [do what] because [what&rsquo;s
              actually in the way].
            </p>
          </div>

          <Field label="Your problem situation, in one sentence" required>
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

          <div className="rounded-card border border-ink/10 bg-white p-4 text-sm text-slate">
            <p className="font-semibold text-charcoal">
              Now reframe it as the question your Research Pod would work to
              answer:
            </p>
            <p className="mt-1 italic">
              How might we [action] for [who] so that [what changes]?
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

      {/* PART 5 */}
      {step === 5 && (
        <section className="space-y-6">
          <div>
            <h2 className="t-h3 text-ink">
              Part 5 — Context for Voters
            </h2>
            <p className="mt-1 text-sm text-meta">
              This section is read by active Cycle participants during the
              voting window. Give them enough to make a real decision — about
              whether the situation matters and whether they want to work on
              it. Everything here is optional.
            </p>
          </div>

          <Field
            label="What has already been tried?"
            hint={"Programs, tools, workarounds — even if they partially work. “Nothing I know of” is a valid answer."}
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
            label="Why does this matter beyond the individual?"
            hint={"Who else is affected — a neighborhood, a sector, a workforce? What’s the scale?"}
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
            hint={"Be specific — “someone who has worked in city government,” “a designer,” “someone who has used this system themselves.”"}
          >
            <textarea
              value={skillsNeeded}
              onChange={(e) => setSkillsNeeded(e.target.value)}
              maxLength={2000}
              rows={3}
              className={textareaClass}
            />
          </Field>

          <Field label="Impact Track" hint="Optional — helps us connect your Pod to the right mentors and advisors. If it cuts across more than one, pick the primary.">
            <div className="space-y-2">
              {IMPACT_TRACKS.map((track) => (
                <label
                  key={track}
                  className="flex cursor-pointer items-center gap-2 text-sm text-charcoal transition-colors duration-150 hover:text-ink"
                >
                  <input
                    type="radio"
                    name="impact_track"
                    value={track}
                    checked={impactTrack === track}
                    onChange={() => setImpactTrack(track)}
                    className="h-4 w-4 accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                  />
                  {track}
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal transition-colors duration-150 hover:text-ink">
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

          <Field label="Cycle Theme Alignment" hint="Each Cycle recruits mentors and advisors around a specific industry theme. If your situation connects to the current theme, note it here.">
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal transition-colors duration-150 hover:text-ink">
                <input
                  type="radio"
                  name="theme"
                  checked={themeAlignment === "none"}
                  onChange={() => setThemeAlignment("none")}
                  className="accent-teal"
                />
                No particular connection
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal transition-colors duration-150 hover:text-ink">
                <input
                  type="radio"
                  name="theme"
                  checked={themeAlignment === "direct"}
                  onChange={() => setThemeAlignment("direct")}
                  className="accent-teal"
                />
                My situation sits directly inside this theme
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-charcoal transition-colors duration-150 hover:text-ink">
                <input
                  type="radio"
                  name="theme"
                  checked={themeAlignment === "adjacent"}
                  onChange={() => setThemeAlignment("adjacent")}
                  className="accent-teal"
                />
                My situation touches this theme from an adjacent angle
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

      {/* PART 6 — the tool's own rules, as a self-check */}
      {step === 6 && (
        <section className="space-y-6">
          <div>
            <h2 className="t-h3 text-ink">
              Part 6 — Before You Submit
            </h2>
            <p className="mt-1 text-sm text-meta">
              Read your distilled situation one more time. These are the same
              rules the Triangulator held you to — check each box honestly.
            </p>
          </div>

          <div className="rounded-card border border-ink/10 bg-white p-4">
            {sitTitle.trim() && (
              <p className="mb-1 text-sm font-semibold text-ink">
                {sitTitle.trim()}
              </p>
            )}
            <p className="text-sm italic text-charcoal">
              &ldquo;{statementText}&rdquo;
            </p>
          </div>

          <div className="space-y-3">
            <CheckItem
              checked={checkGrounded}
              onChange={setCheckGrounded}
              label="Every claim traces back to extracts on my map — evidence, not vibes"
            />
            <CheckItem
              checked={checkActors}
              onChange={setCheckActors}
              label={"It points at real, specific actors — people I could name or find, not “society”"}
            />
            <CheckItem
              checked={checkNoSolution}
              onChange={setCheckNoSolution}
              label="It proposes no solution — the situation stays open for the pod to frame"
            />
            <CheckItem
              checked={checkParadox}
              onChange={setCheckParadox}
              label={"The paradox is self-undoing (X requires not-X) — not a mere trade-off or “it's complicated”"}
            />
            <CheckItem
              checked={checkSamePicture}
              onChange={setCheckSamePicture}
              label="Two strangers reading this would picture the same situation"
            />
          </div>

          {!allChecked && (
            <p className="text-sm text-meta">
              If any box is unchecked, revise before submitting — the workbook
              is one tab away. A sharper situation earns more votes.
            </p>
          )}
        </section>
      )}

      {/* Error */}
      {error && (
        <p
          role="alert"
          className="rounded-card border border-red/20 bg-red/10 px-3 py-2 text-sm text-red"
        >
          {error}
        </p>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between border-t border-ink/10 pt-6">
        <div>
          {step > 1 && (
            <button
              onClick={() => goToStep((step - 1) as Step)}
              className="btn btn-ghost btn-sm"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {step < 6 ? (
            <button
              onClick={() => goToStep((step + 1) as Step)}
              disabled={!canAdvance()}
              className="btn btn-teal btn-sm"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !allChecked}
              className="btn btn-teal btn-sm"
            >
              {submitting ? "Submitting..." : "Submit problem situation"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared helpers ──────────────────────────────────────────────── */

const inputClass =
  "block w-full rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink placeholder:text-meta-soft transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50";

const textareaClass =
  "block w-full resize-none rounded-card border border-ink/10 bg-white px-3 py-2 text-base text-ink placeholder:text-meta-soft transition-colors duration-150 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-charcoal">
        {label}
        {required && (
          <span className="ml-0.5 text-red" aria-hidden>
            *
          </span>
        )}
      </label>
      {hint && (
        <p className="text-xs leading-relaxed text-meta">{hint}</p>
      )}
      {example && (
        <p className="rounded-card border border-ink/10 bg-ink/[0.02] px-3 py-2 text-xs italic leading-relaxed text-meta">
          {example}
        </p>
      )}
      {children}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="mt-1 text-right text-xs text-meta tabular-nums">
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
    <label className="flex cursor-pointer items-start gap-3 text-sm text-charcoal transition-colors duration-150 hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-ink/20 bg-white accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
      />
      <span>{label}</span>
    </label>
  );
}
