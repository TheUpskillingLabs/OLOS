/**
 * Shared pulse-response card.
 *
 * Used by:
 *   - The pulse review side panel (pods/[pod_id]/pulse-review-panel.tsx)
 *     — one card per pulse for a single member.
 *   - The "Recent pulses" feed tab (pods/[pod_id]/recent-pulses-feed.tsx)
 *     — chronological stream of submitted pulses across the whole pod.
 *
 * The feed-tab variant accepts a `header` slot so it can render the
 * member's avatar + name above the response fields; the side-panel
 * variant omits the header (the panel title already identifies the
 * member).
 *
 * Card visuals match the original ResponseCard from the side panel
 * (border, missed-state styling); changing those visuals here is
 * intentional and changes both call sites at once.
 */
import * as React from "react";

export type PulseResponseLike = {
  scheduled_date: string;
  completed_at: string | null;
  survey_responses: Record<string, unknown> | null;
};

export function PulseResponseCard({
  response,
  header,
}: {
  response: PulseResponseLike;
  /** Optional content rendered above the date row (e.g. member identity). */
  header?: React.ReactNode;
}) {
  const submitted = response.completed_at !== null;
  const sr = (response.survey_responses ?? {}) as Record<string, unknown>;
  return (
    <div
      className={`rounded-card border p-4 ${
        submitted
          ? "border-ink/10 bg-white shadow-card"
          : "border-red/20 bg-red/[0.03]"
      }`}
    >
      {header && <div className="mb-3">{header}</div>}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium text-ink tabular-nums">
          {formatDate(response.scheduled_date)}
        </div>
        <div
          className={`text-xs ${
            submitted ? "text-teal-deep" : "text-red"
          }`}
        >
          {submitted
            ? `submitted ${formatTime(response.completed_at!)}`
            : "missed"}
        </div>
      </div>

      {submitted && <ResponseFields sr={sr} />}
    </div>
  );
}

function ResponseFields({ sr }: { sr: Record<string, unknown> }) {
  return (
    <dl className="space-y-2.5 text-xs">
      <TextField sr={sr} keyName="accomplishment" label="What I did" />
      <TextField sr={sr} keyName="highlight" label="Highlight" />
      <TextField sr={sr} keyName="challenge" label="Challenge" />
      <TextField sr={sr} keyName="blockers" label="Blockers" />
      <TextField sr={sr} keyName="tailwinds" label="Tailwinds" />
      <TextField sr={sr} keyName="mitigation_strategy" label="Mitigation" />
      <TextField sr={sr} keyName="anything_else" label="Anything else" />
      <ArrayField sr={sr} keyName="tools_used" label="Tools used" />
    </dl>
  );
}

function TextField({
  sr,
  keyName,
  label,
}: {
  sr: Record<string, unknown>;
  keyName: string;
  label: string;
}) {
  const v = sr[keyName];
  if (typeof v !== "string" || !v.trim()) return null;
  return (
    <div>
      <dt className="mb-0.5 text-meta uppercase tracking-widest text-[10px]">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap text-charcoal">{v}</dd>
    </div>
  );
}

function ArrayField({
  sr,
  keyName,
  label,
}: {
  sr: Record<string, unknown>;
  keyName: string;
  label: string;
}) {
  const v = sr[keyName];
  if (!Array.isArray(v) || v.length === 0) return null;
  return (
    <div>
      <dt className="mb-0.5 text-meta uppercase tracking-widest text-[10px]">
        {label}
      </dt>
      <dd className="flex flex-wrap gap-1.5">
        {v
          .filter((x): x is string => typeof x === "string" && !!x.trim())
          .map((tool) => (
            <span
              key={tool}
              className="rounded-sm bg-ink/[0.04] px-2 py-0.5 text-slate"
            >
              {tool}
            </span>
          ))}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
