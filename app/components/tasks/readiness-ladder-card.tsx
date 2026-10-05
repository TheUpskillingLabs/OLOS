"use client";

import Link from "next/link";
import { useState } from "react";
import type { Task } from "@/lib/tasks/types";
import { TASK_COPY } from "@/lib/tasks/definitions";

/* "Get ready" — the readiness card (#413;
   docs/requirements/between-cycles-dashboard.md §3).

   Rows arrive from the assembler (lib/tasks/readiness.ts), done first. A
   verified row (✓) flips on a record, so it only links to where the record
   is made. A self-attested row (○) is the member's word: "Done" ticks it,
   "Not for me" skips it, and either can be undone — all persisted in
   task_dismissals through /api/tasks/dismiss (POST records, DELETE removes),
   optimistic here so it works on a slow phone. Nothing gates on any of it;
   progress counts only the rows on screen. One DOM tree for every
   breakpoint. */

type Mark = { done: boolean; skipped: boolean };

async function record(key: string, on: boolean): Promise<boolean> {
  try {
    const res = await fetch("/api/tasks/dismiss", {
      method: on ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_key: key }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default function ReadinessLadderCard({
  rows,
  heading,
}: {
  /** The assembler's "prepare" rows, done first. */
  rows: Task[];
  heading: string;
}) {
  const copy = TASK_COPY.prepare;
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [failed, setFailed] = useState(false);

  if (rows.length === 0) return null;

  const markOf = (r: Task): Mark =>
    marks[r.instanceKey] ?? { done: r.done, skipped: !!r.skipped };
  const done = rows.filter((r) => {
    const m = markOf(r);
    return m.done || m.skipped;
  }).length;

  const apply = async (r: Task, next: Mark, key: string, on: boolean) => {
    const prev = markOf(r);
    setMarks((m) => ({ ...m, [r.instanceKey]: next }));
    const ok = await record(key, on);
    if (!ok) {
      setMarks((m) => ({ ...m, [r.instanceKey]: prev }));
      setFailed(true);
    }
  };

  const btn =
    "min-h-11 rounded-card px-3 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal";

  return (
    <section
      id="dash-ready"
      className="mb-8 scroll-mt-24 rounded-card border border-ink/10 bg-white p-5 shadow-card"
      aria-labelledby="ready-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ready-heading" className="t-h3 text-ink">
          {heading}
        </h2>
        <span className="text-xs font-semibold tabular-nums text-teal-deep">
          {copy.progress(done, rows.length)}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-ink/10">
        {rows.map((r) => {
          const m = markOf(r);
          const settled = m.done || m.skipped;
          const glyph = m.done ? "✓" : m.skipped ? "–" : r.verified ? "✓" : "○";
          return (
            <li key={r.instanceKey} className="py-3">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                    m.done
                      ? "bg-teal-deep text-white"
                      : m.skipped
                        ? "bg-ink/10 text-meta"
                        : "border border-ink/25 text-meta"
                  }`}
                >
                  {glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span
                      className={`text-sm font-semibold ${
                        settled ? "text-meta" : "text-ink"
                      } ${m.skipped ? "line-through" : ""}`}
                    >
                      {r.title}
                      <span className="sr-only">
                        {m.done ? " (done)" : m.skipped ? " (not for me)" : " (to do)"}
                      </span>
                    </span>
                    {r.minutes ? (
                      <span className="text-xs tabular-nums text-meta">{r.minutes} min</span>
                    ) : null}
                  </div>
                  {!settled && r.why && (
                    <p className="mt-0.5 text-xs text-meta">{r.why}</p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {!settled &&
                      (r.external ? (
                        <a
                          href={r.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${btn} inline-flex items-center bg-teal/10 text-teal-deep hover:bg-teal/20`}
                        >
                          {r.cta} →
                        </a>
                      ) : (
                        <Link
                          href={r.href}
                          className={`${btn} inline-flex items-center bg-teal/10 text-teal-deep hover:bg-teal/20`}
                        >
                          {r.cta} →
                        </Link>
                      ))}
                    {!r.verified && !settled && (
                      <button
                        type="button"
                        className={`${btn} border border-ink/15 text-charcoal hover:bg-ink/[0.04]`}
                        onClick={() =>
                          apply(r, { done: true, skipped: false }, r.instanceKey, true)
                        }
                      >
                        {copy.markDone}
                      </button>
                    )}
                    {!r.verified && !settled && r.skippable && r.skipKey && (
                      <button
                        type="button"
                        className={`${btn} text-meta hover:text-ink`}
                        onClick={() =>
                          apply(r, { done: false, skipped: true }, r.skipKey!, true)
                        }
                      >
                        {copy.skip}
                      </button>
                    )}
                    {!r.verified && m.done && (
                      <button
                        type="button"
                        className={`${btn} text-meta hover:text-ink`}
                        onClick={() =>
                          apply(r, { done: false, skipped: false }, r.instanceKey, false)
                        }
                      >
                        {copy.unmark}
                      </button>
                    )}
                    {m.skipped && r.skipKey && (
                      <button
                        type="button"
                        className={`${btn} text-meta hover:text-ink`}
                        onClick={() =>
                          apply(r, { done: false, skipped: false }, r.skipKey!, false)
                        }
                      >
                        {copy.unskip}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 border-t border-ink/10 pt-3 text-xs text-meta">{copy.legend}</p>
      {failed && (
        <p className="mt-2 text-xs text-meta" role="status">
          That didn&apos;t save. Check your connection and try again.
        </p>
      )}
    </section>
  );
}
