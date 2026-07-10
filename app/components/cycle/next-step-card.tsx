import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2 } from "lucide-react";
import {
  currentStage,
  nextStage,
  formatStageDate,
  daysUntil,
  type Stage,
} from "@/lib/cycles/stages";

/**
 * The dashboard's answer to "is there anything for me to do right now?" — the
 * load-bearing wayfinding surface, since the six stages are day-separated and a
 * returning user lands cold. If a stage is open, a prominent CTA; otherwise a
 * calm "nothing to do today, next opens {date}" so an off-day visit reassures
 * rather than dead-ends. Presentational: pass the resolved stages + cycle id.
 */
export default function NextStepCard({
  cycleId,
  stages,
}: {
  cycleId: number;
  stages: Stage[];
}) {
  const open = currentStage(stages);
  const next = nextStage(stages);

  if (open) {
    return (
      <Link
        href={`/cycles/${cycleId}/${open.route}`}
        className="group mb-8 flex items-center justify-between gap-4 rounded-card border border-teal/30 bg-teal/10 p-5 transition-colors duration-150 ease-out hover:border-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal" />
          </span>
          <div>
            <p className="lbl lbl-teal">Open now</p>
            <p className="mt-0.5 text-lg font-semibold tracking-tight text-ink">
              {open.action}
            </p>
            {open.close && (
              <p className="mt-0.5 text-sm text-slate tabular-nums">
                closes {formatStageDate(open.close)}
              </p>
            )}
          </div>
        </div>
        <ArrowRight
          className="h-5 w-5 flex-shrink-0 text-teal-deep transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>
    );
  }

  if (next && next.open) {
    const days = daysUntil(next.open);
    return (
      <div className="mb-8 flex items-start gap-3 rounded-card border border-ink/10 bg-white p-5 shadow-card">
        <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-deep" aria-hidden />
        <div>
          <p className="font-semibold tracking-tight text-ink">
            Nothing to do today
          </p>
          <p className="mt-0.5 text-sm text-meta">
            {next.label} opens{" "}
            <span className="tabular-nums text-slate">{formatStageDate(next.open)}</span>
            {days > 0 && (
              <span className="tabular-nums"> · in {days} day{days === 1 ? "" : "s"}</span>
            )}
            . We&rsquo;ll show it here when it&rsquo;s live.
          </p>
        </div>
      </div>
    );
  }

  // Nothing open and nothing upcoming — the participant-facing stages are done.
  return (
    <div className="mb-8 flex items-start gap-3 rounded-card border border-ink/10 bg-white p-5 shadow-card">
      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-deep" aria-hidden />
      <div>
        <p className="font-semibold tracking-tight text-ink">You&rsquo;re all set</p>
        <p className="mt-0.5 text-sm text-meta">
          There are no open steps right now. Keep an eye out for pulse checks and
          your pod&rsquo;s work.
        </p>
      </div>
    </div>
  );
}
