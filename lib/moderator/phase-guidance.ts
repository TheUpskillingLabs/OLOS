/**
 * Phase guidance copy (PRD §7.5).
 *
 * One paragraph per phase orienting the poderator to what their pod
 * should be doing. Tone rule (from PRD §7.10.3): descriptive, not
 * judgmental.
 *
 * The phase-specific signal block (§7.5 bullet 3 — pod-voting counts,
 * solution-proposal submitter identities, project-voting ballots, etc.)
 * is rendered in the page by composing this copy with separate data
 * queries. This module is copy-only so it can be co-located with the
 * other moderator libs and updated by the program team without touching
 * data layers.
 *
 * If a phase has no copy yet, `phaseGuidance` returns null and the page
 * falls back to a generic "Check in with your pod" message.
 */

import type { PhaseNum } from "./phase";

interface PhaseGuidance {
  /** What the phase asks of the pod, plain-English. */
  description: string;
  /** Optional callout for what the poderator should watch for. */
  watchFor?: string;
}

const COPY: Record<PhaseNum, PhaseGuidance> = {
  1: {
    description:
      "Cycle participants are submitting problem statements. Pods haven't formed yet — your assigned pod is provisional. There's nothing for you to action this week.",
  },
  2: {
    description:
      "Cycle participants are voting on problem statements. Pods finalize after voting closes. Healthy engagement at this stage is high ballot completion across the cohort.",
  },
  3: {
    description:
      "Members are registering with the pod for the winning problem. Healthy pods reach the configured minimum headcount before the window closes. Watch for under-registered pods you've been assigned to.",
    watchFor:
      "Pods below the minimum need recruitment outreach. Coordinate with staff if your pod is short.",
  },
  4: {
    description:
      "Members of your pod are drafting solution proposals to the problem your pod is built around. A healthy pod at this stage has at least one proposal from most active members.",
    watchFor:
      "Watch for upskillers who haven't started — that often precedes disengagement.",
  },
  5: {
    description:
      "Members are voting on the solution proposals submitted within your pod. Healthy engagement at this stage is most active members casting their ballot.",
  },
  6: {
    description:
      "Members are registering with one of the winning projects. Projects below the minimum registrant threshold may not move forward — flag those to staff and encourage members to choose.",
    watchFor:
      "Watch for projects that haven't reached the minimum registration count.",
  },
};

export function phaseGuidance(phase: PhaseNum | null): PhaseGuidance | null {
  if (phase === null) return null;
  return COPY[phase] ?? null;
}
