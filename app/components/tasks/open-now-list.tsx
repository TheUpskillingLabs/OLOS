import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Task } from "@/lib/tasks/types";
import { TASK_COPY } from "@/lib/tasks/definitions";

/* "Still open" — the between-cycles list of things worth doing now (#412;
   docs/requirements/between-cycles-dashboard.md §2). A plain vertical list
   on every breakpoint (one DOM tree, CLAUDE.md): unlike the Up-next strip,
   every row is visible on a phone without sideways scrolling, because on
   this screen these rows ARE the content. Rows come from the assembler
   (lib/tasks/open-now.ts), are never dismissible, and always link somewhere.

   Server-safe: no client state. */

export default function OpenNowList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) return null;
  return (
    <section
      className="mb-8 rounded-card border border-ink/10 bg-white p-5 shadow-card"
      aria-labelledby="open-now-heading"
    >
      <h2 id="open-now-heading" className="t-h3 text-ink">
        {TASK_COPY.openNow.heading}
      </h2>
      <ul className="mt-3 divide-y divide-ink/10">
        {tasks.map((t) => (
          <li key={t.instanceKey}>
            <Link
              href={t.href}
              className="group flex min-h-11 items-center justify-between gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{t.title}</span>
                {t.detail && (
                  <span className="mt-0.5 block text-xs text-meta">{t.detail}</span>
                )}
              </span>
              <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-teal-deep">
                {t.cta}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
