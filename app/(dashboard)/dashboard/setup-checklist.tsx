"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/* The setup checklist — leads the dashboard for a new member (prototype
   panel-dashboard: "setup checklist first"). Actionable rows carry a
   visible "Start →" (no hover-only affordances, owner decision); once every
   row is done the whole thing collapses to a "Setup" strip, re-expandable.
   Done-ness is computed server-side; this only owns the collapse.

   The collapse choice persists in localStorage (same member-local pattern
   as up-next.tsx). Before this, collapse was derived purely from allDone —
   adding a new cycle introduced fresh incomplete rows and silently
   re-expanded the list for everyone (July 2026 feedback: "To Do list
   reopens when a new Cycle is added"). The Show/Collapse control lives in
   the header-right in both states so it never jumps position. */

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
}

const KEY = "olos.setupChecklistCollapsed.v1";

export default function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const allDone = items.every((i) => i.done);
  const doneCount = items.filter((i) => i.done).length;

  // null = no stored preference yet → fall back to auto-collapse when done.
  const [stored, setStored] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred past the effect body so the localStorage read + state set
    // isn't a synchronous setState-in-effect (and never runs during SSR).
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw === "1") setStored(true);
        else if (raw === "0") setStored(false);
      } catch {
        /* no store — derive from done-ness */
      }
      setReady(true);
    });
  }, []);

  const setCollapsed = (v: boolean) => {
    setStored(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* best effort */
    }
  };

  // Completing setup cements the collapse, so later cycles adding fresh
  // rows re-surface as a count on the strip instead of a full re-expansion.
  useEffect(() => {
    if (!(ready && allDone && stored === null)) return;
    queueMicrotask(() => setCollapsed(true));
  }, [ready, allDone, stored]);

  // Render nothing until the store is read, so a collapsed list never flashes.
  if (!ready) return null;

  const collapsed = stored ?? allDone;

  if (collapsed) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-card border border-ink/10 bg-white px-5 py-3 shadow-card">
        <span className="text-sm font-semibold text-teal-deep">
          {allDone ? "Setup · All done ✓" : `Setup · ${doneCount} / ${items.length} done`}
        </span>
        <button
          type="button"
          className="text-xs text-meta transition-colors hover:text-ink focus-visible:underline"
          onClick={() => setCollapsed(false)}
        >
          Show
        </button>
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-h3 text-ink">Get set up</h2>
        <span className="flex items-baseline gap-3">
          <span className="text-xs text-meta tabular-nums">
            {doneCount} / {items.length} done
          </span>
          <button
            type="button"
            className="text-xs text-meta transition-colors hover:text-ink focus-visible:underline"
            onClick={() => setCollapsed(true)}
          >
            Collapse
          </button>
        </span>
      </div>
      <ul className="mt-4 divide-y divide-ink/10">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-3 py-3"
          >
            <span className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                  item.done
                    ? "bg-teal-deep text-white"
                    : "border border-ink/25 text-transparent"
                }`}
              >
                ✓
              </span>
              <span
                className={`text-sm ${
                  item.done ? "text-meta line-through" : "text-charcoal"
                }`}
              >
                {item.label}
              </span>
            </span>
            {!item.done && item.href && (
              // In-page anchors (e.g. #learning-log) use a plain <a>: a Next
              // <Link> does a pushState soft-nav that scrolls but never fires
              // `hashchange`, so the feed composer's hash listener wouldn't flip
              // to the Learning Log tab. A native anchor fires it and still scrolls.
              item.href.startsWith("#") ? (
                <a
                  href={item.href}
                  className="flex min-h-11 flex-shrink-0 items-center rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {item.cta ?? "Start"} →
                </a>
              ) : (
                <Link
                  href={item.href}
                  className="flex min-h-11 flex-shrink-0 items-center rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
                >
                  {item.cta ?? "Start"} →
                </Link>
              )
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
