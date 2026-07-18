"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/* The phone-only "Up next" strip — a horizontally-swipeable row of compact
   chips condensing the task cards that lead the desktop center column (log
   due, field survey, register, open cycle windows, setup, leadership log).
   On <768px the feed follows immediately after this strip (feed-first,
   LinkedIn posture); the full task cards land below the feed instead.

   Dismissible chips are the UpNext window todos — they share the SAME
   localStorage store (olos.dismissedTodos.v1, same ids), so dismissing a chip
   here also dismisses the matching desktop card and vice versa. */

const TODOS_KEY = "olos.dismissedTodos.v1";

export interface StripChip {
  /** For dismissible chips: the UpNext todo id (the cycle-window key). */
  id: string;
  eyebrow?: string;
  title: string;
  detail?: string;
  href: string;
  /** Hash anchors need a plain <a>: <Link> soft-navs without a hashchange
      event, and the composer opens its Learning Log tab on hashchange. */
  hashLink?: boolean;
  tone?: "urgent" | "teal" | "default";
  /** Dismissal persists in the shared UpNext todo store. */
  dismissible?: boolean;
}

const TONE_CLASSES: Record<NonNullable<StripChip["tone"]>, string> = {
  urgent: "border-red bg-red/5",
  teal: "border-teal/30 bg-white",
  default: "border-ink/10 bg-white",
};

export default function MobileUpNextStrip({ chips }: { chips: StripChip[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred past the effect body so the localStorage read + state set
    // isn't a synchronous setState-in-effect (and never runs during SSR).
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(TODOS_KEY);
        if (raw) setDismissed(new Set(JSON.parse(raw) as string[]));
      } catch {
        /* no store — show everything */
      }
      setReady(true);
    });
  }, []);

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(TODOS_KEY, JSON.stringify([...next]));
      } catch {
        /* best effort */
      }
      return next;
    });
  };

  // Render nothing until the store is read, so a dismissed chip never flashes.
  if (!ready) return null;
  const visible = chips.filter((c) => !c.dismissible || !dismissed.has(c.id));
  if (visible.length === 0) return null;

  return (
    <section className="mb-6 md:hidden" aria-label="Up next">
      <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {visible.map((c) => {
          const linkClass =
            "font-semibold tracking-tight text-ink after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-teal";
          return (
            <li
              key={c.id}
              className={`relative w-64 shrink-0 snap-start rounded-card border p-4 shadow-card ${TONE_CLASSES[c.tone ?? "default"]}`}
            >
              {c.eyebrow && (
                <div
                  className={`lbl mb-1 ${c.tone === "urgent" ? "text-red" : "lbl-teal"}`}
                >
                  {c.eyebrow}
                </div>
              )}
              <h3 className={`text-sm ${c.dismissible ? "pr-8" : ""}`}>
                {/* The title is the card's tap target: its ::after stretches
                    over the whole chip. Hash anchors stay plain <a> (see
                    StripChip.hashLink). */}
                {c.hashLink ? (
                  <a href={c.href} className={linkClass}>
                    {c.title}
                  </a>
                ) : (
                  <Link href={c.href} className={linkClass}>
                    {c.title}
                  </Link>
                )}
              </h3>
              {c.detail && (
                <p className="mt-0.5 line-clamp-2 text-xs text-meta">
                  {c.detail}
                </p>
              )}
              {c.dismissible && (
                <button
                  type="button"
                  aria-label={`Dismiss ${c.title}`}
                  onClick={() => dismiss(c.id)}
                  className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full text-meta transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  <svg
                    width="12"
                    height="12"
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
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
