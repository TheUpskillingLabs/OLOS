/**
 * Cycle-week math — the single source (server + client). Weeks are numbered
 * 0–12 on the wk0-Kickoff → wk12-Showcase calendar (owner: 12-week model).
 *
 * Extracted from app/(dashboard)/cycles/cycle-phase-indicator.tsx so the API,
 * the dashboard, and the Poderator surface all derive "what week is it?" the
 * same way. Keep the formula identical to the phase-indicator rail.
 *
 * Returns -1 before the cycle starts and 13 after it ends; otherwise 0–12.
 */
export function getCycleWeek(now: Date, start: Date, end: Date): number {
  if (now < start) return -1; // not started — Week 0 (kickoff) hasn't begun
  if (now > end) return 13; // past the Showcase (Week 12)
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;
  const elapsed = now.getTime() - start.getTime();
  // 13 weekly markers, numbered 0–12
  const week = Math.floor((elapsed / totalMs) * 13);
  return Math.min(week, 12);
}
