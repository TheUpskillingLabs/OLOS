"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import {
  formatStageDate,
  daysUntil,
  stageAfter,
  type Stage,
  type StageKey,
} from "@/lib/cycles/stages";

/**
 * "What's next" footer for a stage's completion/success state. Stages are
 * day-separated, so this leads with *when* the next stage opens rather than
 * implying an immediate hop — unless the next window is already open, in which
 * case it becomes a live CTA. Fetches the resolved schedule from
 * /api/cycles/[id]/stages so any client success screen can drop it in with just
 * the cycle id and the stage the user just finished.
 */
export default function NextStepFooter({
  cycleId,
  currentStage,
}: {
  cycleId: number;
  currentStage: StageKey;
}) {
  const [next, setNext] = useState<Stage | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cycles/${cycleId}/stages`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const stages: Stage[] = data?.stages ?? [];
        setNext(stageAfter(stages, currentStage));
      })
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [cycleId, currentStage]);

  if (!loaded) return null;

  // No further stage — send them home.
  if (!next) {
    return (
      <div className="mt-6 border-t border-ink/10 pt-6">
        <Link href="/dashboard" className="btn btn-ghost btn-sm">
          Go to your dashboard
        </Link>
      </div>
    );
  }

  // Next window already open — live, actionable CTA.
  if (next.status === "open") {
    return (
      <div className="mt-6 border-t border-ink/10 pt-6">
        <p className="lbl mb-2">Next step</p>
        <Link
          href={`/cycles/${cycleId}/${next.route}`}
          className="group inline-flex items-center gap-2 btn btn-teal"
        >
          {next.action}
          <ArrowRight
            className="h-4 w-4 transition-transform duration-150 ease-spring group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    );
  }

  // Next window is on a future day — set the return expectation, don't imply "now".
  if (next.status === "upcoming" && next.open) {
    const days = daysUntil(next.open);
    return (
      <div className="mt-6 border-t border-ink/10 pt-6">
        <p className="lbl mb-2">What&rsquo;s next</p>
        <div className="flex items-start gap-3 rounded-card border border-ink/10 bg-tint/40 p-4">
          <CalendarClock className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-deep" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold tracking-tight text-ink">
              {next.label} opens {formatStageDate(next.open)}
              {days > 0 && (
                <span className="font-normal text-meta tabular-nums">
                  {" "}
                  · in {days} day{days === 1 ? "" : "s"}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-meta">
              Nothing to do until then — we&rsquo;ll surface it on your dashboard
              when it&rsquo;s live.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
