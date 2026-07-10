import type { ReactNode } from "react";

/**
 * Shared completion/confirmation screen for the flow stages. Extracted so the
 * emotional beats (submit a proposal, register, cast a ballot) all land the same
 * way and match the join-ceremony bar — a check medallion, the thing you did
 * echoed back, and a slot for a next-step footer / edit affordance. Voice stays
 * "encouraging, not effusive" (no confetti): a quiet ✓ and move on.
 */
export default function SuccessScreen({
  title,
  detail,
  meta,
  children,
}: {
  /** Past-tense headline, e.g. "Problem statement submitted". */
  title: string;
  /** The thing you did, echoed back — a name/summary. Optional. */
  detail?: ReactNode;
  /** Secondary line, e.g. "You can edit until Mar 18". Optional. */
  meta?: ReactNode;
  /** Actions and/or a <NextStepFooter />. Optional. */
  children?: ReactNode;
}) {
  return (
    <div className="[animation:viewIn_0.18s_cubic-bezier(0.2,0.7,0.1,1)]">
      <div className="rounded-card border border-teal/30 bg-teal/10 p-5">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-teal/20"
            aria-hidden
          >
            <svg className="h-4 w-4 text-teal-deep" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 10.5l3.5 3.5L15 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold tracking-tight text-ink">{title}</p>
            {detail && <p className="mt-1 text-sm text-slate">{detail}</p>}
            {meta && <div className="mt-2 text-xs text-meta tabular-nums">{meta}</div>}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
