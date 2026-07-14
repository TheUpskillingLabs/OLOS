import { getCycleWeek } from "@/lib/cycle/week";
import { parseWindow } from "@/lib/cycles/lab-time";

/* Which of the three cycle phases is "now"? — the single derivation for
 * phase-contextual copy (the weekly Learning Log's collaboration and
 * contribution stems swap wording by phase).
 *
 *   1 — Problem Discovery & Definition   (wk 0–3)
 *   2 — Exploration & Experimentation    (wk 4–7)
 *   3 — Prototype Building & Iterating   (wk 8–12)
 *
 * Primary source: cycle_config.phase_2_start / phase_3_start (00006), the
 * same admin-set stamps the phase-indicator rail reads. They're naive-UTC
 * TIMESTAMPs (S5.1 convention), so they go through parseWindow — never
 * new Date(raw). Fallback when either stamp is unset (mirrors the
 * indicator's both-required guard): the rail's week thresholds via
 * getCycleWeek. Pre-start clamps to 1 and post-end to 3 — the stems must
 * always render something sensible.
 */
export type CyclePhase = 1 | 2 | 3;

export function getCyclePhase(
  now: Date,
  cycle: { start_date: string; end_date: string },
  config: {
    phase_2_start: string | null;
    phase_3_start: string | null;
  } | null
): CyclePhase {
  const p2 = parseWindow(config?.phase_2_start);
  const p3 = parseWindow(config?.phase_3_start);
  if (p2 && p3) {
    if (now < p2) return 1;
    if (now < p3) return 2;
    return 3;
  }
  const week = getCycleWeek(
    now,
    new Date(cycle.start_date),
    new Date(cycle.end_date)
  );
  if (week <= 3) return 1; // includes -1 (pre-start)
  if (week <= 7) return 2;
  return 3; // includes 13 (post-end)
}
