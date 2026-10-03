/* The public expectation line while no Build Cycle is recruiting publicly.
 *
 * Interim (2026-10-03, epic #477, decision #480): Cycle 4 runs as an internal
 * org cycle and the owner set the next PUBLIC cycle for 2027. Every surface
 * that would otherwise advertise "the next cycle" (homepage banner,
 * /build-cycles, the sign-up card, the welcome email, the dashboard) reads
 * this one place instead of hard-coding a year. Lane U's getPublicCycleState
 * (#414) replaces it with data; when the 2027 cycle row exists, this line
 * stops rendering wherever a real cycle is shown. Ops log: #481.
 *
 * Pure (no Supabase), so it is safe in client components and email templates.
 */

export const NEXT_PUBLIC_CYCLE_YEAR = 2027;

/** The year the next public cycle opens, or null once that year has passed
 *  (so a forgotten constant degrades to the general sentence, never a stale
 *  promise). */
export function nextPublicCycleYear(
  now: Date = new Date(),
  year: number = NEXT_PUBLIC_CYCLE_YEAR
): number | null {
  return year >= now.getUTCFullYear() ? year : null;
}

/** One sentence, no promise the platform cannot keep. */
export function nextPublicCycleLine(
  now: Date = new Date(),
  year: number = NEXT_PUBLIC_CYCLE_YEAR
): string {
  const y = nextPublicCycleYear(now, year);
  return y
    ? `The next public Build Cycle opens in ${y}.`
    : "The next public Build Cycle is being planned.";
}
