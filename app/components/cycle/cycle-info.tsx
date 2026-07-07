import type { ReactNode } from "react";
import { cycleStatusLabel } from "@/lib/cycles/status";
import { cycleInfoContent } from "@/lib/cycles/info";

// Shared presentation for a cycle's information page. Used by both the public
// page (/c/[id]) and the authenticated cycle overview (/cycles/[id]) so the two
// stay in sync. Content is admin-authored with a structured fallback; the caller
// supplies the call-to-action (public: "Sign in to register"; authenticated:
// "Register").
export interface CycleInfoCycle {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  description?: string | null;
  what_you_build?: string | null;
}

export function CycleInfo({
  cycle,
  cta,
}: {
  cycle: CycleInfoCycle;
  cta?: ReactNode;
}) {
  const { description, whatYouBuild } = cycleInfoContent(cycle);
  const startLong = new Date(cycle.start_date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const endLong = new Date(cycle.end_date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const upcoming = cycle.status === "upcoming";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="lbl lbl-teal mb-3">{cycleStatusLabel(cycle.status)}</div>
      <h1 className="t-h1 mb-3 text-ink">{cycle.name}</h1>
      <p className="t-lede mb-8 text-meta">
        {upcoming ? `Starts ${startLong}` : `${startLong} – ${endLong}`}
      </p>

      <div className="space-y-8 rounded-card border border-ink/10 bg-white p-6 shadow-card sm:p-8">
        <section>
          <h2 className="lbl mb-3">About this cycle</h2>
          <p className="whitespace-pre-line leading-relaxed text-charcoal">
            {description}
          </p>
        </section>
        <section>
          <h2 className="lbl mb-3">What you&rsquo;ll build</h2>
          <p className="whitespace-pre-line leading-relaxed text-charcoal">
            {whatYouBuild}
          </p>
        </section>
      </div>

      {cta && <div className="mt-8">{cta}</div>}
    </div>
  );
}
