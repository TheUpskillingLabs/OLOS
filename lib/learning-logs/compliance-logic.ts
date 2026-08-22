/* Learning Log compliance — the pure resolution logic for the member-facing
   "submit at least one reflection" expectation. Kept free of any Supabase
   import so the matrix below is unit-testable without mocks
   (lib/learning-logs/compliance-logic.test.ts); lib/learning-logs/compliance.ts
   is the thin Supabase-reading wrapper that feeds this.

   This is a SOFT-NUDGE layer, not a gate. It does not lock anyone out and it
   writes nothing — it turns the two signals the app already computes into one
   member-facing status a dashboard card and an email can speak from:

     1. the weekly gate  (lib/learning-logs/gate.ts): is this cycle's window
        armed, and has the member filed a qualifying log since the stamp, and
     2. the at-risk run  (lib/learning-logs/at-risk.ts): how many CONSECUTIVE
        completed weeks the member has missed, floored so it never reaches past
        the week they joined a pod or the week the cohort's ritual began.

   The hard weekly lock (app/(dashboard)/layout.tsx) and the warn→revoke cron
   (app/api/cron/revocation-check) are unchanged and out of scope here; this
   status only ever drives a gentle, dismissible nudge for the population the
   lock does not already speak to (a member one week behind, before the lock),
   and it deliberately mirrors the revocation cron's own threshold
   (cycle_config.at_risk_consecutive_misses) so the nudge and the eventual
   warning tell the same story rather than two contradictory ones.

   Scope note: like the gate lock and the revocation loop, compliance is
   reckoned only for status='active' (in-a-pod) members of an active, mode='open'
   cycle. A pre-pod 'registered' member can log but is never nudged here — the
   weekly cadence is a pod practice (see the gate.ts header). */

export type LogComplianceStatus =
  /** No expectation to surface: not an active in-pod member of an armed cycle. */
  | "not_applicable"
  /** Armed window met this week and no prior consecutive misses — nothing to say. */
  | "on_track"
  /** Armed window not yet met this week, but the member is not behind. */
  | "due_now"
  /** At least one completed week missed, still under the at-risk threshold. */
  | "behind"
  /** Missed weeks have reached the threshold the revocation cron warns at. */
  | "at_risk";

/** The three signals the resolver combines, per cycle. Built by compliance.ts
    from the same reads the gate and the revocation cron already do. */
export interface LogComplianceInput {
  /** The member holds a status='active' enrollment in this cycle. */
  isActiveMember: boolean;
  /** The cycle's window is stamped (cycle_config.log_due_at) and not paused. */
  armed: boolean;
  /** A learning_logs row attributed to this cycle exists at/after the stamp. */
  hasLoggedThisWindow: boolean;
  /** Consecutive completed weeks missed (lib/learning-logs/at-risk.ts). */
  missedWeeks: number;
  /** cycle_config.at_risk_consecutive_misses — the count the revocation cron
      warns at (default 2 upstream; guarded to >= 1 here). */
  atRiskThreshold: number;
}

export interface LogComplianceState {
  status: LogComplianceStatus;
  missedWeeks: number;
  atRiskThreshold: number;
  /** True for the statuses a soft nudge should surface (due_now/behind/at_risk).
      on_track and not_applicable never nudge. */
  nudge: boolean;
}

/**
 * Resolve one cycle's compliance status from the gate + at-risk signals.
 *
 * Precedence is "most serious first": a member who is behind on prior weeks is
 * `behind`/`at_risk` regardless of the current window, because missedWeeks
 * counts only COMPLETED weeks (the in-progress week is never a miss — see
 * at-risk.ts), so it and the current-window signal are about different weeks.
 * Only when there are no missed completed weeks does the current armed window
 * decide between `due_now` and `on_track`.
 *
 * The threshold is floored at 1 so a misconfigured cycle_config value of 0 (or
 * negative) can never mark an on-cadence member `at_risk`.
 */
export function resolveLogCompliance(
  input: LogComplianceInput
): LogComplianceState {
  const {
    isActiveMember,
    armed,
    hasLoggedThisWindow,
    missedWeeks,
    atRiskThreshold,
  } = input;

  const base = { missedWeeks, atRiskThreshold };
  const threshold = atRiskThreshold >= 1 ? atRiskThreshold : 1;

  // No cadence to be compliant with: not an active member, or the cycle's
  // window has never been armed (or is paused for a holiday).
  if (!isActiveMember || !armed) {
    return { status: "not_applicable", nudge: false, ...base };
  }

  if (missedWeeks >= threshold) {
    return { status: "at_risk", nudge: true, ...base };
  }
  if (missedWeeks >= 1) {
    return { status: "behind", nudge: true, ...base };
  }
  if (!hasLoggedThisWindow) {
    return { status: "due_now", nudge: true, ...base };
  }
  return { status: "on_track", nudge: false, ...base };
}

/** Ranking for "which cycle's status should the dashboard lead with" when a
    dual-enrolled member has more than one. Higher = more urgent. */
const STATUS_RANK: Record<LogComplianceStatus, number> = {
  at_risk: 4,
  behind: 3,
  due_now: 2,
  on_track: 1,
  not_applicable: 0,
};

export function complianceRank(status: LogComplianceStatus): number {
  return STATUS_RANK[status];
}

/** The copy a surface (dashboard card or email) speaks from. One voice,
    professional and firm, never shaming. We do compel the weekly submission,
    but the framing leads with why it's in the member's own interest: the
    Learning Log tracks their progress, keeps their Poderator and pod in the
    loop, and accrues into the record they'll later draw on to write up their
    project — a portfolio artifact, not a chore. That their reflection also
    helps us improve each cycle is real but secondary. The copy always points at
    the same one-click way to file, and never threatens (the warning ladder is
    the revocation cron's job, not this nudge's). Returns null for the two
    non-nudging statuses. */
export interface LogComplianceCopy {
  /** info = a light heads-up; warn = firmer but still kind. Drives styling. */
  tone: "info" | "warn";
  headline: string;
  body: string;
  cta: string;
}

export function logComplianceCopy(
  state: LogComplianceState,
  opts: { cycleName: string }
): LogComplianceCopy | null {
  const { cycleName } = opts;
  const cta = "Save a Learning Log";

  switch (state.status) {
    case "due_now":
      return {
        tone: "info",
        headline: `This week's Learning Log for ${cycleName} is open`,
        body:
          "A few quick questions — about five minutes. It keeps your Poderator " +
          "and pod up to date on where you are, and builds the running record of " +
          "your progress you'll draw on when you write up your project later.",
        cta,
      };
    case "behind": {
      const n = state.missedWeeks;
      return {
        tone: "info",
        headline: `You're a week or two behind on ${cycleName}`,
        body:
          `${n === 1 ? "One week" : `${n} weeks`} without a Learning Log. It's ` +
          "worth catching up: the log tracks your own progress, keeps your " +
          "Poderator in the loop, and if something's in the way, saying so here " +
          "is how it gets unblocked.",
        cta,
      };
    }
    case "at_risk":
      return {
        tone: "warn",
        headline: `Your ${cycleName} Learning Log needs your attention`,
        body:
          `You've gone ${state.missedWeeks} weeks without one. A few minutes ` +
          "puts your progress back on record and your Poderator back in the " +
          "loop — and if you're stuck, that's exactly what to note in the log so " +
          "we can help.",
        cta,
      };
    case "on_track":
    case "not_applicable":
      return null;
  }
}
