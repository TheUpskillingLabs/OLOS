"use client";

import { useState } from "react";
import type { LogComplianceStatus } from "@/lib/learning-logs/compliance-logic";

/* The Learning Log compliance nudge — a soft, dismissible heads-up shown above
   the composer when a member is due, a little behind, or (still gently) at the
   revocation threshold. It NEVER blocks: the hard weekly lock lives in the
   dashboard layout, and this card only nudges the population that lock does not
   already speak to (e.g. a member one week behind, before any lock).

   The copy is computed on the server (lib/learning-logs/compliance-logic.ts,
   logComplianceCopy) and threaded in as props, so the server-only compliance
   reader never enters the browser bundle — same split the baseline section uses.

   Dismissal is session-local for now (the card returns next load). Persisting a
   dismissal would reuse the existing task_dismissals table — noted as a
   follow-up rather than built here, to keep this slice read-only. */

export interface ComplianceNudgeProps {
  status: LogComplianceStatus;
  tone: "info" | "warn";
  headline: string;
  body: string;
  cta: string;
  /** Anchor to the composer on the same page (default "#log-composer"). */
  composeHref?: string;
}

export default function ComplianceNudge({
  status,
  tone,
  headline,
  body,
  cta,
  composeHref = "#log-composer",
}: ComplianceNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const warn = tone === "warn";
  const frame = warn
    ? "border-red/30 bg-red/[0.05]"
    : "border-teal/25 bg-teal/[0.05]";
  const ctaClass = warn
    ? "bg-red text-white hover:bg-red/90"
    : "bg-teal-deep text-white hover:bg-teal-deep/90";

  return (
    <div
      className={`relative rounded-card border p-4 ${frame}`}
      role="status"
      data-compliance-status={status}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-meta hover:text-ink"
      >
        ×
      </button>
      <h3 className="t-h4 pr-6 text-ink">{headline}</h3>
      <p className="mt-1 text-sm text-charcoal">{body}</p>
      <a
        href={composeHref}
        className={`mt-3 inline-block rounded-card px-4 py-2 text-sm font-semibold transition-colors duration-150 ${ctaClass}`}
      >
        {cta}
      </a>
    </div>
  );
}
