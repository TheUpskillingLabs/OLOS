"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Task } from "@/lib/tasks/types";
import { CHECKLIST_HIDE_KEY } from "@/lib/tasks/definitions";

/* "Get set up" — the account-housekeeping checklist (port of the old
   dashboard setup-checklist, task consolidation 2026-07). Rows come from
   the assembler as kind="setup" tasks; done-ness is computed server-side —
   including the Slack row, whose done state is now its task_dismissals row
   (issue #189's workaround made cross-device).

   Collapse stays a localStorage UI pref (cosmetic view state, no
   cross-device stake); the "All done" strip gains a Hide control that
   records the CHECKLIST_HIDE_KEY dismissal — the checklist finally has an
   end state (docs/feedback-running-list.md), safe now that the row set is
   stable account housekeeping. */

const COLLAPSE_KEY = "olos.setupChecklistCollapsed.v1";

async function postDismissal(taskKey: string): Promise<void> {
  try {
    await fetch("/api/tasks/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_key: taskKey }),
    });
  } catch {
    /* best effort */
  }
}

export default function ChecklistCard({ items }: { items: Task[] }) {
  // null = no stored preference yet → fall back to auto-collapse when done.
  const [stored, setStored] = useState<boolean | null>(null);
  const [clicked, setClicked] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  // An advisory row (Slack) flips to done the moment its CTA is clicked —
  // optimistic here, persisted as its dismissal row.
  const resolved = items.map((i) =>
    i.advisory && clicked.has(i.instanceKey) ? { ...i, done: true } : i
  );
  const allDone = resolved.every((i) => i.done || i.advisory);
  const doneCount = resolved.filter((i) => i.done).length;

  useEffect(() => {
    // Deferred past the effect body so the localStorage read + state set
    // isn't a synchronous setState-in-effect (and never runs during SSR).
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(COLLAPSE_KEY);
        if (raw === "1") setStored(true);
        else if (raw === "0") setStored(false);
      } catch {
        /* no store — derive from done-ness */
      }
      setReady(true);
    });
  }, []);

  const markClicked = (item: Task) => {
    setClicked((prev) => new Set(prev).add(item.instanceKey));
    void postDismissal(item.instanceKey);
  };

  const setCollapsed = (v: boolean) => {
    setStored(v);
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
    } catch {
      /* best effort */
    }
  };

  // Completing setup cements the collapse so the list never re-expands
  // on its own.
  useEffect(() => {
    if (!(ready && allDone && stored === null)) return;
    queueMicrotask(() => setCollapsed(true));
  }, [ready, allDone, stored]);

  const hide = () => {
    setHidden(true);
    void postDismissal(CHECKLIST_HIDE_KEY);
  };

  if (items.length === 0 || hidden) return null;
  // Render nothing until the collapse pref is read, so a collapsed list
  // never flashes open.
  if (!ready) return null;

  const collapsed = stored ?? allDone;

  if (collapsed) {
    return (
      <div className="mb-6 flex items-center justify-between gap-3 rounded-card border border-ink/10 bg-white px-5 py-3 shadow-card">
        <span className="text-sm font-semibold text-teal-deep">
          {doneCount === resolved.length
            ? "Setup · All done ✓"
            : `Setup · ${doneCount} / ${resolved.length} done`}
        </span>
        <span className="flex items-center gap-4">
          {allDone && (
            <button
              type="button"
              className="text-xs text-meta transition-colors hover:text-ink focus-visible:underline"
              onClick={hide}
            >
              Hide
            </button>
          )}
          <button
            type="button"
            className="text-xs text-meta transition-colors hover:text-ink focus-visible:underline"
            onClick={() => setCollapsed(false)}
          >
            Show
          </button>
        </span>
      </div>
    );
  }

  const rowCta =
    "flex min-h-11 flex-shrink-0 items-center rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

  return (
    <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-h3 text-ink">Get set up</h2>
        <span className="flex items-baseline gap-3">
          <span className="text-xs text-meta tabular-nums">
            {doneCount} / {resolved.length} done
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
        {resolved.map((item) => (
          <li
            key={item.instanceKey}
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
                {item.title}
              </span>
            </span>
            {!item.done &&
              (item.external ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={item.advisory ? () => markClicked(item) : undefined}
                  className={rowCta}
                >
                  {item.cta ?? "Start"} →
                </a>
              ) : item.href.startsWith("#") ? (
                // In-page anchors use a plain <a> so hashchange fires (the
                // feed composer's Learning Log tab opens on it).
                <a href={item.href} className={rowCta}>
                  {item.cta ?? "Start"} →
                </a>
              ) : (
                <Link href={item.href} className={rowCta}>
                  {item.cta ?? "Start"} →
                </Link>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
