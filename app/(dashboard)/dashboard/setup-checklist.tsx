"use client";

import Link from "next/link";
import { useState } from "react";

/* The setup checklist — leads the dashboard for a new member (prototype
   panel-dashboard: "setup checklist first"). Actionable rows carry a
   visible "Start →" (no hover-only affordances, owner decision); once every
   row is done the whole thing collapses to a "Setup · All done ✓" strip,
   re-expandable. Done-ness is computed server-side; this only owns the
   collapse. */

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
}

export default function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const allDone = items.every((i) => i.done);
  const [expanded, setExpanded] = useState(false);

  if (allDone && !expanded) {
    return (
      <div className="mb-6 flex items-center justify-between rounded-card border border-ink/10 bg-white px-5 py-3 shadow-card">
        <span className="text-sm font-semibold text-teal-deep">
          Setup · All done ✓
        </span>
        <button
          type="button"
          className="text-xs text-meta transition-colors hover:text-ink focus-visible:underline"
          onClick={() => setExpanded(true)}
        >
          Show
        </button>
      </div>
    );
  }

  const doneCount = items.filter((i) => i.done).length;

  return (
    <section className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <div className="flex items-baseline justify-between">
        <h2 className="t-h3 text-ink">Get set up</h2>
        <span className="text-xs text-meta tabular-nums">
          {doneCount} / {items.length} done
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
              <Link
                href={item.href}
                className="flex-shrink-0 rounded-card bg-teal/10 px-3 py-1 text-xs font-semibold tracking-tight text-teal-deep transition-all duration-150 hover:bg-teal/20 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
              >
                {item.cta ?? "Start"} →
              </Link>
            )}
          </li>
        ))}
      </ul>
      {allDone && (
        <button
          type="button"
          className="mt-3 text-xs text-meta transition-colors hover:text-ink focus-visible:underline"
          onClick={() => setExpanded(false)}
        >
          Collapse
        </button>
      )}
    </section>
  );
}
