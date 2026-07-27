"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Task } from "@/lib/tasks/types";
import { fmtLabDateTime } from "@/lib/cycles/lab-time";
import {
  deadlineUrgency,
  timeLeftLabel,
  urgencyTextClass,
} from "@/lib/tasks/urgency";

/* One task card — the single rendering of a queue task on every breakpoint
   (app/components/tasks/CLAUDE.md). Tone/variant derive from the task's
   kind, never per-callsite; the deadline is formatted HERE (lab-time), so
   no caller ever formats a window instant itself.

   The dismiss affordance (44px top-right X) renders only for dismissible,
   non-blocking tasks — the absence of an X is the pinned signal. */

type Variant = "urgent" | "feature" | "teal" | "default";

function variantFor(task: Task): Variant {
  if (task.kind === "weekly_log") return "urgent";
  if (task.kind === "survey_contribute" || task.kind === "register")
    return "feature";
  if (task.tone === "teal") return "teal";
  return "default";
}

const VARIANT_CLASSES: Record<Variant, string> = {
  urgent: "border-red bg-red/5",
  feature: "border-teal/30 bg-white",
  teal: "border-teal/30 bg-teal/[0.04]",
  default: "border-ink/10 bg-white",
};

/** Full-width cards on desktop (gate + the feature hero span the grid). */
export function spansGrid(task: Task): boolean {
  const v = variantFor(task);
  return v === "urgent" || v === "feature";
}

function TaskLink({
  task,
  className,
  children,
}: {
  task: Pick<Task, "href" | "hashLink" | "external">;
  className: string;
  children: React.ReactNode;
}) {
  // In-page anchors stay plain <a>: a Next <Link> soft-nav never fires
  // hashchange, and the feed composer opens its Learning Log tab on it.
  if (task.hashLink || task.href.startsWith("#")) {
    return (
      <a href={task.href} className={className}>
        {children}
      </a>
    );
  }
  if (task.external) {
    return (
      <a
        href={task.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={task.href} className={className}>
      {children}
    </Link>
  );
}

export default function TaskCard({
  task,
  onDismiss,
}: {
  task: Task;
  onDismiss?: (task: Task) => void;
}) {
  const variant = variantFor(task);
  // The deadline line — phrased by kind (a window "closes"; an authored
  // task is "due"), formatted here so callers never format instants. When
  // the task also carries a detail, both render. Within 3 days the line
  // escalates (lib/tasks/urgency.ts): teal-deep semibold + "N days left",
  // red inside 24 h — same tiers TaskRow uses on the cycle pages.
  const now = new Date();
  const urgency = deadlineUrgency(task.deadline, now);
  const left = timeLeftLabel(task.deadline, now);
  const deadlineLine = task.deadline
    ? `${
        task.kind === "custom"
          ? `Due ${fmtLabDateTime(task.deadline)}`
          : `Open now — closes ${fmtLabDateTime(task.deadline)}`
      }${left ? ` · ${left}` : ""}`
    : null;
  const deadlineClass = urgencyTextClass(urgency);
  const detail = task.detail ?? deadlineLine;
  const detailIsDeadline = !task.detail && !!deadlineLine;
  const extraDeadline = task.detail && deadlineLine ? deadlineLine : null;
  const dismissable = task.dismissible && !task.blocking && !!onDismiss;

  // On phones the title is the whole-card tap target (the strip contract);
  // on md+ the explicit CTA row takes over and the overlay is disabled so
  // secondary links stay clickable.
  const titleLinkClass =
    "font-semibold tracking-tight text-ink max-md:after:absolute max-md:after:inset-0 max-md:after:rounded-card focus-visible:outline-none max-md:focus-visible:after:ring-2 max-md:focus-visible:after:ring-teal";

  return (
    <div
      className={`relative flex h-full flex-col rounded-card border p-4 shadow-card md:p-5 ${VARIANT_CLASSES[variant]}`}
      role={task.blocking ? "alert" : undefined}
    >
      {dismissable && (
        <button
          type="button"
          aria-label={`Dismiss ${task.title}`}
          onClick={() => onDismiss(task)}
          className="absolute right-0 top-0 z-10 flex h-11 w-11 items-center justify-center rounded-full text-meta transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        >
          <svg width="13" height="13" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 5L17 17M17 5L5 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {task.eyebrow && (
        <div
          className={`lbl mb-1 ${variant === "urgent" ? "text-red" : "lbl-teal"}`}
        >
          {task.eyebrow}
        </div>
      )}
      <h3 className={`text-sm md:t-h4 md:text-base ${dismissable ? "pr-8" : ""}`}>
        <TaskLink task={task} className={titleLinkClass}>
          {task.title}
        </TaskLink>
      </h3>
      {detail && (
        <p
          className={`mt-1 text-xs max-md:line-clamp-2 md:text-sm ${
            detailIsDeadline && deadlineClass ? deadlineClass : "text-meta"
          }`}
        >
          {detail}
        </p>
      )}
      {extraDeadline && (
        <p
          className={`mt-1 text-xs tabular-nums ${
            deadlineClass || "font-semibold text-teal-deep"
          }`}
        >
          {extraDeadline}
        </p>
      )}
      {(task.cta || task.secondaryHref) && (
        <div className="mt-3 hidden flex-wrap items-center gap-x-4 gap-y-1 md:flex">
          {task.cta &&
            (variant === "urgent" || variant === "feature" ? (
              <TaskLink
                task={task}
                className="inline-flex items-center gap-1.5 rounded-card bg-teal-deep px-4 py-2 text-sm font-semibold tracking-tight text-white transition-colors duration-150 hover:bg-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
              >
                {task.cta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </TaskLink>
            ) : (
              <TaskLink
                task={task}
                className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight text-teal-deep hover:underline"
              >
                {task.cta} →
              </TaskLink>
            ))}
          {task.secondaryHref && task.secondaryCta && (
            <Link
              href={task.secondaryHref}
              className="inline-flex items-center gap-1.5 text-sm text-meta hover:text-teal-deep hover:underline"
            >
              {task.secondaryCta} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
