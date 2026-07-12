"use client";

/* The signed-in footer — a slim utility strip closing every dashboard page.
   Carries the two asks testers couldn't find (July 2026 feedback: "more
   prominent Support button, and add it to the footer"): the feedback/support
   launcher (the same olos:open-feedback event the avatar menu fires — the
   widget is mounted by the dashboard layout) and the every.org support link
   that otherwise lives only in the dashboard's Quick links rail. */

export default function DashboardFooter() {
  return (
    <footer className="mt-8 border-t border-ink/10 bg-white">
      <div className="container flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4">
        <span className="text-xs text-meta">The Upskilling Labs</span>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("olos:open-feedback"))
            }
            className="text-sm font-semibold text-teal-deep hover:underline focus-visible:underline focus-visible:outline-none"
          >
            Get support / send feedback
          </button>
          <a
            href="https://www.every.org/theupskillinglabs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-teal-deep hover:underline"
          >
            Support The Labs &rarr;
          </a>
        </div>
      </div>
    </footer>
  );
}
