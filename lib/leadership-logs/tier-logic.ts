/* The Leadership Log's pure scope-state logic (docs/ORG_CYCLES.md §4a).
   Kept free of any Supabase import so the matrix is unit-testable without
   mocks (tier-logic.test.ts); lib/leadership-logs/scopes.ts is the thin
   Supabase-reading wrapper that feeds this.

   Unlike the Learning Log gate (lib/learning-logs/gate-logic.ts), the
   Leadership Log is NON-BLOCKING — there is no `active`/lockout field. The
   cascade is expressed as derived day offsets from a single weekly stamp
   (cycle_config.leadership_log_due_at, armed Wednesday): the member tier logs
   Wednesday (that's the Learning Log, not here), workstream leads Thursday
   (+1), lab leads Friday (+2). "Due" is purely a dashboard/reminder signal:
   armed and not yet submitted this week. */

export type LeadershipTier = "workstream_lead" | "lab_lead";

/** Days after the Wednesday stamp that a tier's log is targeted. */
const TIER_OFFSET_DAYS: Record<LeadershipTier, number> = {
  workstream_lead: 1, // Thursday
  lab_lead: 2, // Friday
};

const TIER_DAY_NAME: Record<LeadershipTier, string> = {
  workstream_lead: "Thursday",
  lab_lead: "Friday",
};

/** One scope a participant occupies (a run pod they lead, or a lab they lead),
    with that scope's cycle window config + whether they've logged this week. */
export interface LeadershipScopeInput {
  tier: LeadershipTier;
  cycleId: number;
  cycleName: string;
  /** Set for workstream_lead (the run pod). */
  podId: number | null;
  /** Set for lab_lead (the lab / metros id). */
  labId: number | null;
  /** Display label for the scope picker — the workstream or lab name. */
  scopeLabel: string;
  leadershipLogDueAt: string | null;
  gatePaused: boolean;
  submittedThisWeek: boolean;
}

export interface LeadershipScopeState extends LeadershipScopeInput {
  /** A due date is stamped and the window isn't paused. */
  armed: boolean;
  /** Armed and not yet submitted this week — the non-blocking "to do" signal. */
  due: boolean;
  /** The tier's target weekday name ("Thursday" / "Friday"). */
  targetDay: string;
  /** `now` has reached this scope's target day (stamp + tier offset). */
  dueDayPassed: boolean;
}

export function resolveLeadershipScopes(
  inputs: LeadershipScopeInput[],
  now: Date
): LeadershipScopeState[] {
  return inputs.map((s) => {
    const armed = s.leadershipLogDueAt !== null && !s.gatePaused;
    let dueDayPassed = false;
    if (armed && s.leadershipLogDueAt) {
      const target = new Date(s.leadershipLogDueAt);
      target.setUTCDate(target.getUTCDate() + TIER_OFFSET_DAYS[s.tier]);
      dueDayPassed = now.getTime() >= target.getTime();
    }
    return {
      ...s,
      armed,
      due: armed && !s.submittedThisWeek,
      targetDay: TIER_DAY_NAME[s.tier],
      dueDayPassed,
    };
  });
}
