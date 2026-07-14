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

/** The blank slate: scales sit at the neutral middle (3), the AI-usage pick is
    unset (0), free responses empty. */
export const DEFAULT_BASELINE_ANSWERS: BaselineAnswers = {
  ai_usage_frequency: 0,
  work_shift_outlook: "",
  role_change_outlook: "",
  skills_readiness: 3,
  learning_confidence: 3,
  judgment_confidence: 3,
  autonomy: 3,
  peer_investment: 3,
};

/** A baseline is complete once the one required pick — AI-usage frequency — is
    a valid 1–5 choice. Scales default to a neutral middle and the two free
    responses are optional, so nothing else can block the save. */
export function isBaselineComplete(v: BaselineAnswers): boolean {
  return v.ai_usage_frequency >= 1 && v.ai_usage_frequency <= 5;
}

const SCALE = [1, 2, 3, 4, 5];

// Self-contained scale row (deliberately NOT the card's ScaleRow import): the
// baseline uses shared agree/disagree anchors shown once above the group, so
// its row carries just the prompt + an optional attribution note, no per-row
// low/high labels.
function BaselineScaleRow({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note?: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {note && <p className="mt-0.5 text-xs text-meta">{note}</p>}
      <div className="mt-2 flex gap-2" role="radiogroup" aria-label={label}>
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
  cycleName,
  questions,
  aiUsageOptions,
  value,
  onChange,
}: {
  cycleName: string;
  questions: BaselineQuestion[];
  aiUsageOptions: { value: number; label: string }[];
  value: BaselineAnswers;
  onChange: (v: BaselineAnswers) => void;
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
      <div>
        <p className="lbl">Baseline</p>
        <h3 className="t-h4 text-ink">Baseline Learning Log — {cycleName}</h3>
        <p className="mt-1 text-sm text-charcoal">
          A one-time snapshot before you start — your answers set the baseline
          we&apos;ll measure growth against.
        </p>
      </div>

      {/* AI-usage frequency — the one required pick, as a radio-pill group. */}
      {choiceQuestion && (
        <div>
          <span className="text-sm font-semibold text-ink">
            {choiceQuestion.prompt}
          </span>
          <div
            className="mt-2 flex flex-wrap gap-2"
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

      {/* Readiness scales — shared 1–5 agree/disagree anchors, shown once. */}
      <div className="space-y-4">
        <p className="text-xs text-meta">
          1 = Strongly disagree · 5 = Strongly agree
        </p>
        {scaleQuestions.map((q) => (
          <BaselineScaleRow
            key={q.key}
            label={q.prompt}
            note={q.note}
            value={Number(value[q.key])}
            onChange={(v) => update(q.key, v)}
          />
        ))}
      </div>
    </div>
  );
}
