/* The readiness ladder — the between-cycles "Get ready" card (#413;
   docs/requirements/between-cycles-dashboard.md §3).

   Nine named steps. Each row is shown only when the member can actually
   take it (a step that needs an announced cycle hides while none is
   announced; a step that needs a guide hides until the guide is published),
   so progress — "{done} of {shown} ready" — only ever counts rows on
   screen. Verified rows (✓) flip on a record; self-attested rows (○) are
   the member's word, recorded in task_dismissals, with a reversible
   "Not for me". Nothing gates on any of it.

   Pure module: no Supabase, importable from client components. */

import type { Task } from "./types";
import { PRIORITY, TASK_COPY, SLACK_INVITE_FALLBACK } from "./definitions";
import { prepareSkipKey, prepareTaskKey, setupTaskKey, type PrepareStep } from "./keys";

/** Published resource slugs the ladder links to (handoff brief §6.2). */
export const READINESS_RESOURCE_SLUGS = {
  assistant: "onboarding-ai-assistant",
  videos: "onboarding-welcome",
  primerFor: (cycleSlug: string) => `primer-${cycleSlug}`,
} as const;

export interface ReadinessInputs {
  /** The announced (upcoming) open cycle, if any. */
  upcomingCycle: { id: number; name: string; slug: string | null } | null;
  /** Signed the upcoming cycle's agreement. */
  preRegistered: boolean;
  /** metro_id points at an active lab. */
  labActive: boolean;
  /** City of a metro_waitlist_signups row, when the member is waiting. */
  waitlistCity: string | null;
  githubUsername: string | null;
  /** headline + profile photo + at least one role intent. */
  directoryCardDone: boolean;
  /** Published resources slugs among the ones the ladder links to. */
  publishedSlugs: ReadonlySet<string>;
}

type StepDef = {
  step: PrepareStep;
  shown: boolean;
  verified: boolean;
  /** Verified rows: the record. Manual rows: computed from dismissals. */
  verifiedDone?: boolean;
  title: string;
  href: string;
  external?: boolean;
  cycleId?: number;
};

export function buildReadinessRows(
  input: ReadinessInputs,
  dismissedKeys: ReadonlySet<string>,
  slackInviteUrl?: string | null
): Task[] {
  const copy = TASK_COPY.prepare.steps;
  const up = input.upcomingCycle;
  const primerSlug = up?.slug ? READINESS_RESOURCE_SLUGS.primerFor(up.slug) : null;

  const defs: StepDef[] = [
    {
      step: "lab",
      shown: true,
      verified: true,
      verifiedDone: input.labActive || input.waitlistCity != null,
      title:
        !input.labActive && input.waitlistCity
          ? copy.lab.waitlistTitle(input.waitlistCity)
          : copy.lab.title,
      href: "/local-labs",
    },
    {
      step: "register",
      shown: up != null,
      verified: true,
      verifiedDone: input.preRegistered,
      title: up ? copy.register.title(up.name) : "",
      // Pre-registration needs an active lab (requireActiveLabMembership):
      // a lab-less member is routed to the lab step instead of a 403.
      href: up && input.labActive ? `/cycles/${up.id}/join` : "/local-labs",
      cycleId: up?.id,
    },
    {
      step: "dates",
      shown: up != null,
      verified: false,
      title: copy.dates.title,
      href: up ? `/cycles/${up.id}` : "/events",
      cycleId: up?.id,
    },
    {
      step: "slack",
      shown: true,
      verified: false,
      title: copy.slack.title,
      href: slackInviteUrl || SLACK_INVITE_FALLBACK,
      external: true,
    },
    {
      step: "github",
      shown: true,
      verified: true,
      verifiedDone: !!input.githubUsername?.trim(),
      title: copy.github.title,
      href: "/profile/edit",
    },
    {
      step: "assistant",
      shown: input.publishedSlugs.has(READINESS_RESOURCE_SLUGS.assistant),
      verified: false,
      title: copy.assistant.title,
      href: `/library/${READINESS_RESOURCE_SLUGS.assistant}`,
    },
    {
      step: "primer",
      shown: up != null && primerSlug != null && input.publishedSlugs.has(primerSlug),
      verified: false,
      title: up ? copy.primer.title(up.name) : "",
      href: primerSlug ? `/library/${primerSlug}` : "/learning",
      cycleId: up?.id,
    },
    {
      step: "card",
      shown: true,
      verified: true,
      verifiedDone: input.directoryCardDone,
      title: copy.card.title,
      href: "/profile/edit",
    },
    {
      step: "videos",
      shown: input.publishedSlugs.has(READINESS_RESOURCE_SLUGS.videos),
      verified: false,
      title: copy.videos.title,
      href: `/library/${READINESS_RESOURCE_SLUGS.videos}`,
    },
  ];

  const rows: Task[] = [];
  defs.forEach((d, i) => {
    if (!d.shown) return;
    const key = prepareTaskKey(d.step, d.cycleId);
    const skipKey = d.verified ? undefined : prepareSkipKey(d.step, d.cycleId);
    // Slack is one step whichever card recorded it: the account checklist's
    // `setup:slack` click and the ladder's `prepare:slack` tick both count.
    const ticked =
      dismissedKeys.has(key) ||
      (d.step === "slack" && dismissedKeys.has(setupTaskKey("slack")));
    const done = d.verified ? !!d.verifiedDone : ticked;
    const skipped = !done && !!skipKey && dismissedKeys.has(skipKey);
    const stepCopy = copy[d.step];
    rows.push({
      defId: `prepare:${d.step}`,
      kind: "prepare",
      instanceKey: key,
      title: d.title,
      href: d.href,
      external: d.external,
      cta: stepCopy.cta,
      deadline: null,
      priority: PRIORITY.prepareBase + i,
      tone: "default",
      blocking: false,
      // Ticks and skips are recorded by the card, never by the queue's
      // dismissal filter.
      dismissible: false,
      done,
      surface: "prepare",
      why: stepCopy.why,
      minutes: stepCopy.minutes,
      verified: d.verified,
      skippable: !d.verified,
      skipped,
      skipKey,
    });
  });

  // Done and skipped rows first (endowed progress), ladder order within.
  return rows.sort((a, b) => {
    const ar = a.done || a.skipped ? 0 : 1;
    const br = b.done || b.skipped ? 0 : 1;
    return ar !== br ? ar - br : a.priority - b.priority;
  });
}

/** "{done} of {shown}" — skipped rows count (the member decided). */
export function readinessProgress(rows: Task[]): { done: number; shown: number } {
  return {
    done: rows.filter((r) => r.done || r.skipped).length,
    shown: rows.length,
  };
}
