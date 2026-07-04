"use client";

import { useState } from "react";
import { persistUiState } from "./switcher";

/* The orientation card — the A-vs-B answer the Pod Squad memo asked in
   writing (restored from the prototype; the PRD's "handbook + kickoff"
   cut didn't hold). Dismiss persists via moderator_ui_state.tooltip_seen
   so it never comes back for this poderator. */

const SEEN_KEY = "orientation_card";

export default function OrientationCard({
  tooltipSeen,
}: {
  tooltipSeen: string[];
}) {
  const [dismissed, setDismissed] = useState(
    tooltipSeen.includes(SEEN_KEY)
  );
  if (dismissed) return null;

  return (
    <section className="mb-6 rounded-card border border-teal/30 bg-teal/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="lbl">How the pieces fit</p>
          <h2 className="t-h3 text-ink">You’re the shepherd here</h2>
          <p className="mt-2 text-sm text-charcoal">
            OLOS is the practice record and the formation pipeline — the
            member experience comes first, and this dashboard exists to help
            you unblock people, not manage them. Luma runs events. Slack is
            where people talk. Members have wide latitude while they’re
            making forward progress: unblock what you can, grade nothing,
            and when the process itself trips someone, that’s a signal about
            the process — never a mark against the member.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-meta transition-colors hover:bg-ink/5 hover:text-ink"
          onClick={() => {
            setDismissed(true);
            persistUiState({ tooltip_seen: [...tooltipSeen, SEEN_KEY] });
          }}
        >
          <svg width="16" height="16" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 5L17 17M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </section>
  );
}
