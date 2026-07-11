/**
 * The Build Cycle's three month-long phases — titles, week spans, and the
 * member-facing sentence of what each phase actually IS. Extracted from the
 * phase indicator so the timeline (timing) and the My Cycle hub (meaning)
 * describe the same model; the blurbs close the "timing everywhere, meaning
 * nowhere" gap flagged in docs/audit/GAP_AUDIT.md §A4.
 */

export interface CyclePhaseDef {
  num: 1 | 2 | 3;
  title: string;
  /** Week-number span on the 0–12 rail. */
  weeks: string;
  /** What happens and what's expected of you — conversational register. */
  blurb: string;
}

export const CYCLE_PHASES: readonly CyclePhaseDef[] = [
  {
    num: 1,
    title: "Problem Discovery & Definition",
    weeks: "0–3",
    blurb:
      "The cycle starts by looking, not building. The cohort gathers field observations, proposes problem statements, and votes on which problems matter most — then pods form around the winners.",
  },
  {
    num: 2,
    title: "Exploration & Experimentation",
    weeks: "4–7",
    blurb:
      "Your pod digs into its problem — running experiments and doing the homework nobody assigned. That digging becomes solution proposals, and everyone votes on what to build.",
  },
  {
    num: 3,
    title: "Prototype Building & Iterating",
    weeks: "8–12",
    blurb:
      "Winning proposals become project teams. You build something real with mentors alongside you, then bring it all — wins and misses — to the closing Showcase + Summit.",
  },
] as const;

/** Which phase a rail week falls in: 0 before kickoff, else 1–3. Same
    boundaries the phase indicator's header row highlights. */
export function phaseForWeek(week: number): 0 | 1 | 2 | 3 {
  if (week < 0) return 0;
  if (week <= 3) return 1;
  if (week <= 7) return 2;
  return 3;
}
