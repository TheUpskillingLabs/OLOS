"use client";

import { useEffect, useState } from "react";

/* "What's next" — the per-week, admin-authored nudge shown once the member has
   logged for the current cycle week (the dashboard gates rendering on both a
   message existing and a log this week). Dismissal is member-local, faithful to
   up-next.tsx's localStorage pattern: the stored value is the "{cycleId}:{week}"
   token, so a dismissal auto-expires at the week rollover — a new week's token
   no longer matches the stored one and the card returns. */

const KEY = "olos.whatsNextDismissed.v1";

export default function WhatsNextCard({
  cycleId,
  week,
  message,
}: {
  cycleId: number;
  week: number;
  message: string;
}) {
  const token = `${cycleId}:${week}`;
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred past the effect body so the localStorage read + state set isn't
    // a synchronous setState-in-effect (and never runs during SSR).
    queueMicrotask(() => {
      try {
        if (localStorage.getItem(KEY) === token) setDismissed(true);
      } catch {
        /* no store — show it */
      }
      setReady(true);
    });
  }, [token]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, token);
    } catch {
      /* best effort */
    }
  };

  // Render nothing until the store is read, so a dismissed card never flashes.
  if (!ready || dismissed) return null;

  return (
    <section className="mb-8">
      <div className="relative rounded-card border border-teal/30 bg-teal/[0.04] p-5 shadow-card">
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-meta transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5 5L17 17M17 5L5 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="lbl lbl-teal mb-1.5">What&apos;s next · Week {week}</div>
        <p className="pr-8 text-sm text-charcoal">{message}</p>
      </div>
    </section>
  );
}
