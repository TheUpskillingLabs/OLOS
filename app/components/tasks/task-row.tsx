import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { fmtLabDate, fmtLabDateTime } from "@/lib/cycles/lab-time";

/* The cycle-page task grammar — a full-width status row (app/components/
   tasks/CLAUDE.md). Cycle pages describe the CYCLE's state, not the
   member's queue: rows are never dismissible, and they use the exact same
   action labels as the dashboard cards (both come from the window
   registry).

     open     → teal row, pulsing dot, "closes {date}"
     upcoming → white row, muted dot, "opens {date, time}"
     info     → white row with the teal left rule (survey / gallery /
                learning-log links)

   Server-safe: no client hooks. */

export default function TaskRow({
  title,
  detail,
  href,
  state = "info",
  closesAt,
  opensAt,
  icon,
  external,
  secondary,
}: {
  title: string;
  detail?: string;
  /** Omit for a purely informational row (e.g. an upcoming window that has
      no page to visit yet) — renders as a static row, no arrow. */
  href?: string;
  state?: "open" | "upcoming" | "info";
  /** Naive-UTC window instants — formatted here, never by the caller. */
  closesAt?: string | null;
  opensAt?: string | null;
  icon?: ReactNode;
  external?: boolean;
  /** A second door (e.g. survey results). The row becomes a static
      container with the title + secondary as their own links, since links
      don't nest. */
  secondary?: { href: string; label: string };
}) {
  const shell =
    state === "open"
      ? "border-teal/30 bg-teal/10 hover:border-teal"
      : state === "upcoming"
        ? "border-ink/10 bg-white shadow-card"
        : "border-ink/10 border-l-4 border-l-teal bg-white shadow-card hover:bg-ink/[0.02]";

  const timing =
    state === "open" && closesAt
      ? `closes ${fmtLabDate(closesAt)}`
      : state === "upcoming" && opensAt
        ? `opens ${fmtLabDateTime(opensAt)}`
        : null;

  const dot =
    state === "open" ? (
      <span className="relative flex h-2 w-2 flex-shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
      </span>
    ) : state === "upcoming" ? (
      <span
        className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-ink/20"
        aria-hidden
      />
    ) : null;

  const className = `group flex items-center justify-between gap-3 rounded-card border p-4 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${shell}`;

  // Two-door rows (title + secondary link) can't be one big link — links
  // don't nest — so the container goes static and each door is its own link.
  if (href && secondary) {
    return (
      <div className={className.replace("group ", "")}>
        <div className="flex items-center gap-3">
          {dot}
          {icon}
          <div>
            <Link
              href={href}
              className="font-semibold tracking-tight text-ink hover:text-teal-deep focus-visible:outline-none focus-visible:underline"
            >
              {title}
            </Link>
            {detail && <p className="mt-0.5 text-sm text-meta">{detail}</p>}
            <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Link
                href={href}
                className="inline-flex items-center gap-1 font-semibold text-teal-deep hover:text-teal focus-visible:outline-none focus-visible:underline"
              >
                Open <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href={secondary.href}
                className="text-meta transition-colors hover:text-teal-deep hover:underline focus-visible:outline-none focus-visible:underline"
              >
                {secondary.label}
              </Link>
            </span>
          </div>
        </div>
        {timing && (
          <span className="flex-shrink-0 text-sm text-meta tabular-nums">
            {timing}
          </span>
        )}
      </div>
    );
  }

  const body = (
    <>
      <div className="flex items-center gap-3">
        {dot}
        {icon}
        <div>
          <span className="font-semibold tracking-tight text-ink">{title}</span>
          {detail && <p className="mt-0.5 text-sm text-meta">{detail}</p>}
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 text-sm text-meta">
        {timing && <span className="tabular-nums">{timing}</span>}
        {href && (
          <ArrowRight
            className="h-4 w-4 text-teal-deep transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        )}
      </div>
    </>
  );

  if (!href) {
    return <div className={className.replace("group ", "")}>{body}</div>;
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}
