"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { AMBASSADOR_APPLY, AMBASSADOR_HOME, AMBASSADOR_PROGRAM_PAGE, ui } from "@/lib/ambassador/content";
import type { LaunchBannerVariant } from "@/lib/ambassador/launch";

/* The Ambassador launch banner, top of the dashboard's center column
   (lib/ambassador/launch.ts decides who sees which version). DESIGN_SYSTEM.md
   "Banners / alerts", the Info / active type, with the ambassador button in
   place of the icon. Dismissing records a task_dismissals row (the same
   endpoint as task cards), so it stays gone on every device. */

export function AmbassadorLaunchBanner({ variant, dismissKey }: { variant: LaunchBannerVariant; dismissKey: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const c = ui.launch;
  const launch = variant === "launch";

  const dismiss = () => {
    setHidden(true); // optimistic: a failed write only means it shows again next visit
    void fetch("/api/tasks/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_key: dismissKey }),
    }).catch(() => {});
  };

  return (
    <section
      aria-labelledby="amb-launch-title"
      className="relative mb-6 flex items-start gap-4 rounded-md border border-teal/20 bg-teal/[0.04] p-4 pr-12 sm:p-5 sm:pr-14"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ambassador/button-400.webp" alt="" width={56} height={56} className="h-14 w-14 flex-shrink-0 max-sm:h-11 max-sm:w-11" />
      <div className="min-w-0 flex-1">
        {launch && <p className="lbl lbl-teal">{c.eyebrow}</p>}
        <h2 id="amb-launch-title" className="t-h3 text-ink" style={{ marginTop: launch ? 4 : 0 }}>
          {launch ? c.title : c.pendingTitle}
        </h2>
        <p className="mt-1 text-sm text-charcoal">{launch ? c.body : c.pendingBody}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link className="btn btn-teal btn-sm" href={launch ? AMBASSADOR_APPLY : AMBASSADOR_HOME}>
            {launch ? c.apply : c.pendingCta}
          </Link>
          {launch && (
            <Link className="text-sm font-medium text-teal-deep underline underline-offset-4" href={AMBASSADOR_PROGRAM_PAGE}>
              {c.learnMore}
            </Link>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={c.dismiss}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-md text-slate hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
}
