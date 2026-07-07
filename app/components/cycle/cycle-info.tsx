import type { ReactNode } from "react";
import { cycleInfoContent } from "@/lib/cycles/info";

// Shared presentation for a cycle's public information page. Content is
// admin-authored with a structured fallback; the caller supplies the
// call-to-action (public page: "Sign in to register").
export interface CycleInfoCycle {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  description?: string | null;
  what_you_build?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  active: "Active",
  closing: "Closing",
  archived: "Archived",
  closed: "Closed",
};

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
      <div className="lbl lbl-teal mb-3">
        {STATUS_LABEL[cycle.status] ?? cycle.status}
      </div>
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
