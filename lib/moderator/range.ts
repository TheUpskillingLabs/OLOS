/**
 * The shared time-range filter for the poderator surface (design doc §3):
 * This week (default) / Last 4 weeks / Full cycle, carried as ?range=
 * (absent = week) so ranges are linkable. Each sub-page scopes its own
 * historical data by it; badges always reflect the current week.
 */
export type PodRange = "week" | "4w" | "cycle";

export function parseRange(value: string | undefined | null): PodRange {
  return value === "4w" || value === "cycle" ? value : "week";
}

export const RANGE_LABELS: Record<PodRange, string> = {
  week: "This week",
  "4w": "Last 4 weeks",
  cycle: "Full cycle",
};

/** ISO date-string floor for a range, or null for no lower bound. */
export function rangeSince(range: PodRange, now: Date = new Date()): string | null {
  if (range === "cycle") return null;
  const days = range === "week" ? 7 : 28;
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return since.toISOString();
}
