// Single source of truth for the cycle status vocabulary and how it renders.
// Previously the `CycleStatus` type and a `STATUS_VARIANT` map were duplicated
// across ~6 files as `active | closed | draft`, so `upcoming` (and the other
// real statuses) fell through to an "inactive" badge labeled with the raw string.

// Matches the StatusBadge variant union (app/components/ui/status-badge.tsx).
export type CycleBadgeVariant =
  | "active"
  | "forming"
  | "inactive"
  | "draft"
  | "revoked"
  | "success";

export type CycleStatus =
  | "draft"
  | "upcoming"
  | "active"
  | "closing"
  | "archived"
  | "closed";

export const CYCLE_STATUS_VARIANT: Record<CycleStatus, CycleBadgeVariant> = {
  draft: "draft",
  upcoming: "forming",
  active: "active",
  closing: "forming",
  archived: "inactive",
  closed: "inactive",
};

const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  active: "Active",
  closing: "Closing",
  archived: "Archived",
  closed: "Closed",
};

export function cycleStatusVariant(status: string): CycleBadgeVariant {
  return CYCLE_STATUS_VARIANT[status as CycleStatus] ?? "inactive";
}

export function cycleStatusLabel(status: string): string {
  return CYCLE_STATUS_LABEL[status as CycleStatus] ?? status;
}

// Only genuinely finished cycles belong under a "Past cycles" heading.
const PAST_STATUSES: CycleStatus[] = ["closed", "archived"];
export function isPastCycle(status: string): boolean {
  return PAST_STATUSES.includes(status as CycleStatus);
}

// A cycle that has not started yet (candidate to feature as "coming up").
export function isUpcomingCycle(status: string): boolean {
  return status === "upcoming";
}
