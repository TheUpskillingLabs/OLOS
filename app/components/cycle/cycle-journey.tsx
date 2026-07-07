import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { CycleTimeline, TimelinePhase } from "@/lib/cycle/phases";

/**
 * "Your cycle journey" — the member-facing roadmap of the six operational
 * stages, driven by resolveCycleTimeline. Each stage reads done / happening-now
 * (with the live CTA) / upcoming with its open date / not scheduled, so a member
 * always knows exactly where they are and what's next. The pod stage says "pods
 * are forming" when the window is open but no pods exist yet.
 */

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function weekLabel(week: number): string {
  if (week < 0) return "Starting soon";
  if (week > 12) return "Cycle complete";
  return `Week ${week} of 12`;
}

export default function CycleJourney({
  cycleId,
  timeline,
  week,
  podsReady,
  canAct = true,
}: {
  cycleId: number;
  timeline: CycleTimeline;
  week: number;
  /** Whether pods exist yet — annotates the pod-selection stage. */
  podsReady: boolean;
  /** Whether the viewer may act (false for revoked enrollees → status-only). */
  canAct?: boolean;
}) {
  return (
    <section className="mb-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <div className="lbl lbl-teal mb-1.5">Where you are</div>
          <h2 className="t-h3 text-ink">Your cycle journey</h2>
        </div>
        <span className="text-sm text-meta tabular-nums">{weekLabel(week)}</span>
      </div>

      <ol className="divide-y divide-ink/10 overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
        {timeline.phases.map((p) => (
          <JourneyRow
            key={p.field}
            phase={p}
            cycleId={cycleId}
            podsReady={podsReady}
            canAct={canAct}
          />
        ))}
      </ol>
    </section>
  );
}

function JourneyRow({
  phase: p,
  cycleId,
  podsReady,
  canAct,
}: {
  phase: TimelinePhase;
  cycleId: number;
  podsReady: boolean;
  canAct: boolean;
}) {
  const podsForming = p.field === "pod_registration" && p.state === "open" && !podsReady;
  const live = p.state === "open" && !podsForming;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Marker state={p.state} live={live} />
      <div className="min-w-0 flex-1">
        <span
          className={`block text-sm font-semibold tracking-tight ${
            p.state === "done" ? "text-meta" : "text-ink"
          }`}
        >
          {p.label}
        </span>
        <p className="mt-0.5 text-xs text-meta">{detail(p, podsForming)}</p>
      </div>
      {live && canAct && (
        <Link
          href={`/cycles/${cycleId}/${p.route}`}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-card bg-teal-deep px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
        >
          {p.cta}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </li>
  );
}

function detail(p: TimelinePhase, podsForming: boolean): string {
  if (podsForming) {
    return "Pods are being formed from the winning problem statements — opens as soon as they're ready.";
  }
  switch (p.state) {
    case "done":
      return "Done";
    case "open":
      return p.closeAt ? `Happening now · closes ${fmt(p.closeAt)}` : "Happening now";
    case "upcoming":
      return p.openAt ? `Opens ${fmt(p.openAt)}` : "Coming up";
    case "unscheduled":
      return "Not scheduled yet";
  }
}

function Marker({ state, live }: { state: TimelinePhase["state"]; live: boolean }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-deep text-white">
        <Check className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  if (live) {
    return (
      <span
        className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center"
        aria-hidden
      >
        <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-teal opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-teal" />
      </span>
    );
  }
  // open-but-forming, upcoming, or unscheduled → a hollow node
  return (
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center" aria-hidden>
      <span
        className={`h-3 w-3 rounded-full border-2 ${
          state === "unscheduled" ? "border-ink/15" : "border-teal/50"
        }`}
      />
    </span>
  );
}
