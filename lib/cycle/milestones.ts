/**
 * The two milestone Learning-Log evaluations (Phase 1): a mid-cycle and a final
 * review. They are Learning Log variants (learning_logs.kind), NOT a separate
 * system — same flow, evaluation framing, prefilled from the member's own logs,
 * never grades (prototype renderEvaluations() + backend §6).
 *
 * The weeks they open on are admin-configurable per cycle (cycle_config,
 * migration 00047); the `kind` values stay as opaque legacy IDs
 * (`milestone_7`/`milestone_13` from the old 13-week model) and are surfaced as
 * "Mid-cycle" / "End-cycle" in the UI.
 */

export type MilestoneKind = "milestone_7" | "milestone_13";

/** The two admin-configurable milestone weeks from cycle_config. */
export interface MilestoneWeeks {
  milestone_mid_week: number; // default 6
  milestone_final_week: number; // default 12
}

export interface MilestoneDef {
  kind: MilestoneKind;
  weekOf: (w: MilestoneWeeks) => number;
  /** Full card/header label. */
  label: string;
  /** Short chip/status label. */
  short: string;
}

export const MILESTONES: MilestoneDef[] = [
  {
    kind: "milestone_7",
    weekOf: (w) => w.milestone_mid_week,
    label: "Mid-cycle review",
    short: "Mid-cycle",
  },
  {
    kind: "milestone_13",
    weekOf: (w) => w.milestone_final_week,
    label: "End-cycle review",
    short: "End-cycle",
  },
];

/**
 * Which milestone (if any) opens on this exact cycle week. First match wins if
 * an admin misconfigures both to the same week.
 */
export function milestoneKindForWeek(
  week: number,
  weeks: MilestoneWeeks
): MilestoneKind | null {
  for (const m of MILESTONES) {
    if (m.weekOf(weeks) === week) return m.kind;
  }
  return null;
}

export function milestoneDef(kind: MilestoneKind): MilestoneDef {
  return MILESTONES.find((m) => m.kind === kind) ?? MILESTONES[0];
}

export function milestoneLabel(kind: MilestoneKind): string {
  return milestoneDef(kind).label;
}
