"use client";

import { useEffect, useState } from "react";
import { SIMULATION_BLOCKED_MESSAGE } from "@/lib/auth/simulation-cookie";

/** How long the notice stays up before it clears itself. */
const DISMISS_AFTER_MS = 6000;

/**
 * Gives the read-only block a voice.
 *
 * While a simulation is running every write is rejected with 403 and the
 * message in SIMULATION_BLOCKED_MESSAGE (proxy.ts at the edge, withAuth behind
 * it). Nothing was telling the admin: our optimistic client writes all share
 * one shape (post, and on any failure quietly roll the UI back), so clicking
 * Follow inside a simulation looked like a dead button.
 *
 * This wraps `window.fetch` for the lifetime of the simulation rather than
 * teaching each component to recognise the block. The trade is deliberate:
 * patching one global is a blunt instrument, but it covers every write path
 * that exists today AND every one written later, where the per-component
 * version is a rule each future author has to remember and no test catches
 * when they don't. The wrapper only mounts while a simulation is active (its
 * parent renders nothing otherwise), so ordinary sessions run on the untouched
 * `fetch`.
 *
 * It is strictly an observer: the response is passed back untouched, the body
 * is read off a clone so the caller still gets an unconsumed stream, and any
 * status other than 403 is left completely alone. Callers keep their existing
 * error handling; they just no longer fail in silence.
 */
export default function SimulationWriteGuard() {
  // Object rather than string state so the same message firing twice in a row
  // still restarts the dismiss timer.
  const [notice, setNotice] = useState<{ text: string; at: number } | null>(
    null
  );

  useEffect(() => {
    const original = window.fetch;
    let live = true;

    const wrapped: typeof window.fetch = async (...args) => {
      // `.call(window)` because a detached `fetch` reference is an illegal
      // invocation in Chrome.
      const response = await original.call(window, ...args);
      if (response.status === 403) {
        // A clone, so the caller still receives an unread body.
        void response
          .clone()
          .json()
          .then((body: unknown) => {
            const error = (body as { error?: unknown } | null)?.error;
            if (live && error === SIMULATION_BLOCKED_MESSAGE) {
              setNotice({ text: error, at: Date.now() });
            }
          })
          // A 403 with a non-JSON body belongs to somebody else.
          .catch(() => {});
      }
      return response;
    };

    window.fetch = wrapped;
    return () => {
      live = false;
      // Only hand back what we took. If something else wrapped fetch after us,
      // restoring the original would silently undo their patch too.
      if (window.fetch === wrapped) window.fetch = original;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Clears the same overlays the banner does, and sits just under it.
      className="fixed left-1/2 z-[120] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-card border border-navy/40 bg-white px-4 py-3 text-center text-sm text-ink shadow-card-lg"
      style={{ top: "calc(var(--sim-banner-h) + 0.75rem)" }}
    >
      {notice.text}
    </div>
  );
}
