"use client";

import type { CyclePhase } from "@/lib/cycle/phase";
import { HOURS_BUCKETS, type HoursBucket } from "@/lib/cycles/hours";

/* The weekly Learning Log's v2 question stack (00090) — the nine-item
   instrument for open-cycle weekly logs. Pure controlled component: the
   card owns save/reset/history; this owns rendering and the phase stems.
   Milestone reviews, journal logs, and org-cycle logs keep the v1 form in
   the card itself.

   Order is the owner's: stuck check first (the ask-for-help move opens the
   ritual), then hours → collaboration → progress → contribution → learned
   → capability → energy → the two optionals. */

const SCALE = [1, 2, 3, 4, 5];

export function ScaleRow({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-xs text-meta">
          {low} → {high}
        </span>
      </div>
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

export interface WeeklyV2State {
  stuck: boolean;
  stuckTried: string;
  stuckHelp: string;
  hoursBucket: HoursBucket | null;
  collab: number;
  progress: number;
  contribution: string;
  learned: string;
  capable: number;
  energy: number;
  feelingWord: string;
  recognition: string;
}

export const emptyWeeklyV2State: WeeklyV2State = {
  stuck: false,
  stuckTried: "",
  stuckHelp: "",
  hoursBucket: null,
  collab: 3,
  progress: 3,
  contribution: "",
  learned: "",
  capable: 3,
  energy: 3,
  feelingWord: "",
  recognition: "",
};

/** Required items filled? (1–7; 1b/1c only when stuck; 8/9 optional.) */
export function weeklyV2Complete(s: WeeklyV2State): boolean {
  if (s.stuck && (!s.stuckTried.trim() || !s.stuckHelp.trim())) return false;
  return !!s.hoursBucket && !!s.contribution.trim() && !!s.learned.trim();
}

/* Phase-contextual stems (lib/cycle/phase.ts): before pods form the
   collaboration question reads community-wide; from phase 2 it reads
   pod-level. The contribution prompt tracks what "making" looks like in
   each phase. */
const COLLAB_STEM: Record<CyclePhase, string> = {
  1: "How effective was your collaboration with other Upskillers this week?",
  2: "How effective was your collaboration with your pod this week?",
  3: "How effective was your collaboration with your pod this week?",
};

const CONTRIBUTION_STEM: Record<CyclePhase, string> = {
  1: "What did you explore, read, or learn from this week? Share a link, note, or quote.",
  2: "What did you contribute, draft, or propose this week?",
  3: "What did you build or ship this week? Share a link or screenshot if you have one.",
};

export default function WeeklyV2Fields({
  phase,
  value,
  onChange,
}: {
  phase: CyclePhase;
  value: WeeklyV2State;
  onChange: (patch: Partial<WeeklyV2State>) => void;
}) {
  const v = value;
  const yesNo = (on: boolean, label: string, pick: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={pick}
      className={`h-11 flex-1 rounded-card border text-sm font-semibold transition-colors duration-150 ${
        on
          ? "border-teal-deep bg-teal-deep text-white"
          : "border-ink/15 bg-white text-charcoal hover:border-teal"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-5 space-y-5">
      {/* 1 — stuck check. Same private contract as v1's "I'm blocked":
          member + Poderator + admins, never shared. */}
      <div>
        <span className="text-sm font-semibold text-ink">
          Are you stuck on something right now?
        </span>
        <div
          className="mt-2 flex gap-2"
          role="radiogroup"
          aria-label="Are you stuck on something right now?"
        >
          {yesNo(v.stuck, "Yes", () => onChange({ stuck: true }))}
          {yesNo(!v.stuck, "No", () =>
            onChange({ stuck: false, stuckTried: "", stuckHelp: "" })
          )}
        </div>
      </div>
      {v.stuck && (
        <>
          <div>
            <label
              htmlFor="ll-stuck-tried"
              className="text-sm font-semibold text-ink"
            >
              What have you already tried, and where did it break down?
            </label>
            <textarea
              id="ll-stuck-tried"
              value={v.stuckTried}
              onChange={(e) => onChange({ stuckTried: e.target.value })}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
            />
          </div>
          <div>
            <label
              htmlFor="ll-stuck-help"
              className="text-sm font-semibold text-ink"
            >
              What kind of help would move this forward?
            </label>
            <textarea
              id="ll-stuck-help"
              value={v.stuckHelp}
              onChange={(e) => onChange({ stuckHelp: e.target.value })}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
            />
          </div>
        </>
      )}

      {/* 2 — hours (the onboarding availability buckets, byte-identical). */}
      <div>
        <span className="text-sm font-semibold text-ink">
          How many hours did you put into Labs work this week?
        </span>
        <div
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          role="radiogroup"
          aria-label="How many hours did you put into Labs work this week?"
        >
          {HOURS_BUCKETS.map((bucket) => (
            <button
              key={bucket}
              type="button"
              role="radio"
              aria-checked={v.hoursBucket === bucket}
              onClick={() => onChange({ hoursBucket: bucket })}
              className={`h-11 flex-1 rounded-card border text-sm font-semibold transition-colors duration-150 ${
                v.hoursBucket === bucket
                  ? "border-teal-deep bg-teal-deep text-white"
                  : "border-ink/15 bg-white text-charcoal hover:border-teal"
              }`}
            >
              {bucket}
            </button>
          ))}
        </div>
      </div>

      {/* 3 — collaboration (phase-contextual stem) */}
      <ScaleRow
        label={COLLAB_STEM[phase]}
        low="Not effective"
        high="Very effective"
        value={v.collab}
        onChange={(n) => onChange({ collab: n })}
      />

      {/* 4a — progress */}
      <ScaleRow
        label="How would you rate your progress this week?"
        low="No progress"
        high="Significant progress"
        value={v.progress}
        onChange={(n) => onChange({ progress: n })}
      />

      {/* 4b — contribution (phase-contextual stem) */}
      <div>
        <label
          htmlFor="ll-contribution"
          className="text-sm font-semibold text-ink"
        >
          {CONTRIBUTION_STEM[phase]}
        </label>
        <textarea
          id="ll-contribution"
          value={v.contribution}
          onChange={(e) => onChange({ contribution: e.target.value })}
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
        />
      </div>

      {/* 5 — learned */}
      <div>
        <label htmlFor="ll-learned" className="text-sm font-semibold text-ink">
          What&rsquo;s one thing you learned or figured out this week?
        </label>
        <textarea
          id="ll-learned"
          value={v.learned}
          onChange={(e) => onChange({ learned: e.target.value })}
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
        />
      </div>

      {/* 6 — capability */}
      <ScaleRow
        label="I feel more capable than I did last week."
        low="Strongly disagree"
        high="Strongly agree"
        value={v.capable}
        onChange={(n) => onChange({ capable: n })}
      />

      {/* 7 — energy */}
      <ScaleRow
        label="How's your energy heading into next week?"
        low="Low"
        high="High"
        value={v.energy}
        onChange={(n) => onChange({ energy: n })}
      />

      {/* 8 — optional feeling word */}
      <div>
        <label
          htmlFor="ll-feeling-word"
          className="text-sm font-semibold text-ink"
        >
          One word for how you&rsquo;re feeling{" "}
          <span className="font-normal text-meta">(optional)</span>
        </label>
        <input
          id="ll-feeling-word"
          type="text"
          value={v.feelingWord}
          onChange={(e) =>
            onChange({ feelingWord: e.target.value.replace(/\s/g, "") })
          }
          maxLength={50}
          className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
        />
      </div>

      {/* 9 — optional recognition */}
      <div>
        <label
          htmlFor="ll-recognition"
          className="text-sm font-semibold text-ink"
        >
          Anyone you want to recognize this week?{" "}
          <span className="font-normal text-meta">(optional)</span>
        </label>
        <input
          id="ll-recognition"
          type="text"
          value={v.recognition}
          onChange={(e) => onChange({ recognition: e.target.value })}
          placeholder="Name — one line about what they did"
          maxLength={300}
          className="mt-1 w-full rounded-card border border-ink/15 p-3 text-base"
        />
      </div>
    </div>
  );
}
