/**
 * Pod-health indicator helpers (PRD §7.1).
 *
 * Two responsibilities:
 *   1. `bandFor(missing, cfg)` — classifies a missing-pulse count into
 *      one of three bands (healthy / warning / critical) using the
 *      cycle's configured thresholds.
 *   2. `trendOver3Weeks(...)` — computes a ↑ / ↓ / → arrow from the
 *      last three weeks of pulse-completion rates.
 *
 * Thresholds are absolute headcount (PRD §10 decision) and live on
 * cycle_config (added in migration 00026). Global defaults apply when a
 * cycle's row predates the migration or doesn't override.
 */

export type Band = "healthy" | "warning" | "critical";
export type Trend = "up" | "down" | "flat";

export interface PulseHealthCfg {
  /** Min count to switch from healthy → warning. Default 1. */
  pulse_band_warning_min: number | null;
  /** Min count to switch from warning → critical. Default 3. */
  pulse_band_critical_min: number | null;
}

const DEFAULT_WARNING_MIN = 1;
const DEFAULT_CRITICAL_MIN = 3;

export function bandFor(missing: number, cfg: PulseHealthCfg | null): Band {
  const warningMin = cfg?.pulse_band_warning_min ?? DEFAULT_WARNING_MIN;
  const criticalMin = cfg?.pulse_band_critical_min ?? DEFAULT_CRITICAL_MIN;
  if (missing >= criticalMin) return "critical";
  if (missing >= warningMin) return "warning";
  return "healthy";
}

/**
 * Trend over the most recent three weeks, comparing this week's
 * completion rate against the average of the prior two weeks.
 *
 * `rates` is week-by-week pulse-completion percentage (0..1), oldest
 * first. Need at least two weeks of data for a real trend; fewer than
 * two returns "flat".
 *
 * The tolerance (default 5pp) absorbs tiny week-over-week jitter so the
 * arrow doesn't flip on noise.
 */
export function trendOver3Weeks(
  rates: number[],
  tolerance: number = 0.05
): Trend {
  if (rates.length < 2) return "flat";
  const current = rates[rates.length - 1];
  const prior = rates.slice(-3, -1);
  const priorAvg = prior.reduce((s, r) => s + r, 0) / prior.length;
  const delta = current - priorAvg;
  if (Math.abs(delta) <= tolerance) return "flat";
  return delta > 0 ? "up" : "down";
}
