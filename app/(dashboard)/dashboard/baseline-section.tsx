"use client";

import type {
  BaselineAnswers,
  BaselineQuestion,
} from "@/lib/learning-logs/baseline";

/* The Baseline Learning Log — a one-time onboarding snapshot filed once per
   participant per cycle, BEFORE the weekly ritual begins. It rides along on
   the member's first save (the POST accepts an optional `baseline` key), so it
   renders inline inside the Learning Log card. The whole form is driven off the
   BASELINE_QUESTIONS / AI_USAGE_OPTIONS constants that own the question set in
   lib/learning-logs/baseline.ts.

   Those constants are handed in as props rather than imported here: baseline.ts
   top-level-imports the server-only Supabase client (for pendingBaselineCycles),
   so pulling its runtime exports into this client component would drag
   `next/headers` into the browser bundle. The server component (dashboard
   page) reads the constants and threads them down. Types are `import type`d
   (erased at build), so they're safe to reference directly. */

/** Config surfaced from the server so the client renders the canonical
    question set without importing the server-tainted baseline module. */
export interface BaselineConfig {
  cycleId: number;
  cycleName: string;
  questions: BaselineQuestion[];
  aiUsageOptions: { value: number; label: string }[];
}

/** The blank slate: every pick — the AI-usage choice and all five scales —
    starts unset (0) so nothing is answered by default; free responses empty. */
export const DEFAULT_BASELINE_ANSWERS: BaselineAnswers = {
  ai_usage_frequency: 0,
  work_shift_outlook: "",
  role_change_outlook: "",
  skills_readiness: 0,
  learning_confidence: 0,
  judgment_confidence: 0,
  autonomy: 0,
  peer_investment: 0,
};

const PICKED = (n: number) => n >= 1 && n <= 5;

const REQUIRED_PICKS: (keyof BaselineAnswers)[] = [
  "ai_usage_frequency",
  "autonomy",
  "skills_readiness",
  "learning_confidence",
  "judgment_confidence",
  "peer_investment",
];

/** The required picks — the AI-usage choice and all five scales — that don't
    yet hold a deliberate 1–5 answer. Empty means the form can save; the card
    uses the non-empty case to highlight exactly what's missing (only the two
    free responses are optional). */
export function missingBaselineKeys(
  v: BaselineAnswers
): (keyof BaselineAnswers)[] {
  return REQUIRED_PICKS.filter((k) => !PICKED(Number(v[k])));
}

const SCALE = [1, 2, 3, 4, 5];

// Self-contained scale row (deliberately NOT the card's ScaleRow import): the
// baseline uses shared agree/disagree anchors shown once above the group, so
// its row carries just the prompt, no per-row low/high labels.
function BaselineScaleRow({
  label,
  missing,
  value,
  onChange,
}: {
  label: string;
  missing?: boolean;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {missing && (
        <p className="mt-0.5 text-sm font-semibold text-red">Choose an answer</p>
      )}
      <div
        className={`mt-2 flex gap-2 ${
          missing ? "rounded-card ring-1 ring-red ring-offset-2" : ""
        }`}
        role="radiogroup"
        aria-label={label}
      >
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`h-11 flex-1 rounded-card border text-sm font-semibold transition-colors duration-150 ${
              value === n
                ? "border-teal-deep bg-teal-deep text-white"
                : "border-ink/15 bg-white text-charcoal hover:border-teal"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function BaselineSection({
  questions,
  aiUsageOptions,
  value,
  onChange,
  missingKeys,
}: {
  questions: BaselineQuestion[];
  aiUsageOptions: { value: number; label: string }[];
  value: BaselineAnswers;
  onChange: (v: BaselineAnswers) => void;
  /** Required picks the member tried to save without — flagged in red. */
  missingKeys?: Set<string>;
}) {
  function update<K extends keyof BaselineAnswers>(
    key: K,
    v: BaselineAnswers[K]
  ) {
    onChange({ ...value, [key]: v });
  }

  const choiceQuestion = questions.find((q) => q.type === "choice");
  const textQuestions = questions.filter((q) => q.type === "text");
  const scaleQuestions = questions.filter((q) => q.type === "scale");

  return (
    <div className="mt-5 space-y-6 rounded-card border border-teal/20 bg-teal/[0.04] p-4">
      <h3 className="t-h4 text-ink">Cycle onboarding Learning Log</h3>

      {/* AI-usage frequency — the one required pick, as a radio-pill group. */}
      {choiceQuestion && (
        <div>
          <span className="text-sm font-semibold text-ink">
            {choiceQuestion.prompt}
          </span>
          {missingKeys?.has("ai_usage_frequency") && (
            <p className="mt-0.5 text-sm font-semibold text-red">
              Choose an answer
            </p>
          )}
          <div
            className={`mt-2 flex flex-wrap gap-2 ${
              missingKeys?.has("ai_usage_frequency")
                ? "rounded-card ring-1 ring-red ring-offset-2"
                : ""
            }`}
            role="radiogroup"
            aria-label={choiceQuestion.prompt}
          >
            {aiUsageOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={value.ai_usage_frequency === o.value}
                onClick={() => update("ai_usage_frequency", o.value)}
                className={`min-h-11 rounded-card border px-3 py-2 text-sm font-semibold transition-colors duration-150 ${
                  value.ai_usage_frequency === o.value
                    ? "border-teal-deep bg-teal-deep text-white"
                    : "border-ink/15 bg-white text-charcoal hover:border-teal"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Free-response outlook prompts — optional. */}
      <div className="space-y-4">
        {textQuestions.map((q) => (
          <div key={q.key}>
            <label
              htmlFor={`baseline-${q.key}`}
              className="text-sm font-semibold text-ink"
            >
              {q.prompt}
            </label>
            <textarea
              id={`baseline-${q.key}`}
              value={String(value[q.key])}
              onChange={(e) => update(q.key, e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
            />
          </div>
        ))}
      </div>

      {/* Readiness scales — shared 1–5 agree/disagree anchors, spelled out
          once as a header so nobody has to guess what the numbers mean. */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-ink">
            The next questions all use this scale:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-charcoal">
            <li>1 = Strongly disagree</li>
            <li>3 = Neither agree nor disagree</li>
            <li>5 = Strongly agree</li>
          </ul>
        </div>
        {scaleQuestions.map((q) => (
          <BaselineScaleRow
            key={q.key}
            label={q.prompt}
            missing={missingKeys?.has(q.key)}
            value={Number(value[q.key])}
            onChange={(v) => update(q.key, v)}
          />
        ))}
      </div>
    </div>
  );
}
