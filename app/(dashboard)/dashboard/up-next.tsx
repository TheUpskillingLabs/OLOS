"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/* "Up next" — dismissible suggestion cards (prototype renderTodos): never
   gates, just points at the action that's open right now with a direct CTA
   and its deadline. The phase rail shows the timeline; this gives the
   button. Dismissals persist in localStorage, faithful to the prototype's
   dismissedTodos (member-local, non-critical — no backend needed). */

export interface TodoCard {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

const KEY = "olos.dismissedTodos.v1";

export default function UpNext({ todos }: { todos: TodoCard[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Deferred past the effect body so the localStorage read + state set
    // isn't a synchronous setState-in-effect (and never runs during SSR).
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(KEY);
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
        localStorage.setItem(KEY, JSON.stringify([...next]));
      } catch {
        /* best effort */
      }
      return next;
    });
  };

  // Render nothing until the store is read, so a dismissed card never flashes.
  if (!ready) return null;
  const visible = todos.filter((t) => !dismissed.has(t.id));
  if (visible.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-4">
        <div className="lbl lbl-teal mb-1.5">On your plate</div>
        <h2 className="t-h3 text-ink">Up next for you</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((t) => (
          <div
            key={t.id}
            className="relative rounded-card border border-ink/10 bg-white p-5 shadow-card"
          >
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-meta transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
            >
              <svg width="14" height="14" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 5L17 17M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <h3 className="t-h4 pr-8 text-ink">{t.title}</h3>
            <p className="mt-1 text-sm text-meta">{t.detail}</p>
            <Link
              href={t.href}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-teal-deep hover:underline"
            >
              {t.cta} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
