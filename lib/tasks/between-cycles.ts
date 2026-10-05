/* Who is "between cycles" — the one rule the dashboard (app/(dashboard)/
   dashboard/page.tsx) and the admin preview (lib/tasks/preview.ts) both
   call, so the preview can never drift from what a member sees.

   Spec: docs/requirements/between-cycles-dashboard.md §1 (handoff brief
   §7.M item 1). A member is between cycles when they are in an onboarding
   state (no enrollment on a running open cycle), are not there to shepherd
   (assignment-only Poderator) or to work on the org itself (active org-cycle
   member), and there is nothing to join right now:
     - an upcoming open cycle exists (pre-registration / "get ready"), or
     - no open cycle is running at all (S0 — production from 13 Oct 2026
       until the 2027 public cycle exists), or
     - the running cycle's registration is closed for good.
   A running cycle whose registration is open or merely paused (dead zone)
   keeps today's onboarding view: there is a real "join" to show.

   Pure module: no Supabase, importable from client components. */

import type { RegistrationState } from "@/lib/cycles/schedule";

export interface BetweenCyclesInput {
  /** Dashboard state is no_cycle or no_enrollment. */
  onboarding: boolean;
  /** An active moderator assignment and no enrollment of their own. */
  assignmentOnlyPoderator: boolean;
  /** An active enrollment in the org (mode='org') cycle. */
  orgActive: boolean;
  /** An upcoming open cycle the member could pre-register for. */
  hasUpcomingCycle: boolean;
  /** A running (status active) open cycle. */
  hasActiveCycle: boolean;
  /** registrationWindow() for the running open cycle; null when unknown or
      when there is no running cycle. */
  activeRegistrationState: RegistrationState | null;
}

export function deriveBetweenCycles(input: BetweenCyclesInput): boolean {
  if (!input.onboarding) return false;
  if (input.assignmentOnlyPoderator || input.orgActive) return false;
  if (input.hasUpcomingCycle) return true;
  if (!input.hasActiveCycle) return true;
  return input.activeRegistrationState === "closed";
}

/** The between-cycles state names the spec's §1 table uses — for copy,
    headings, and the admin preview's label. */
export type BetweenCyclesState =
  /** S0 / S3: no cycle announced (none running, or running and closed). */
  | "none_announced"
  /** S1: an upcoming cycle exists and the member hasn't pre-registered. */
  | "announced"
  /** S2: pre-registered for the upcoming cycle. */
  | "pre_registered";

export function betweenCyclesState(input: {
  hasUpcomingCycle: boolean;
  preRegisteredUpcoming: boolean;
}): BetweenCyclesState {
  if (!input.hasUpcomingCycle) return "none_announced";
  return input.preRegisteredUpcoming ? "pre_registered" : "announced";
}
