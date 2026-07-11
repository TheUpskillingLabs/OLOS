/* UI nouns for the two cycle tracks. Mirrors the Poderator/moderator naming
   convention (docs/poderator-dashboard/CLAUDE.md): the DB and code always say
   pod/moderator; what the member sees depends on the cycle's mode. Org cycles
   (docs/ORG_CYCLES.md) present pods as "Workstreams" and their moderators as
   "Co-leads" — same rows, different product surface. */

export function podNoun(mode: string | null | undefined, plural = false): string {
  if (mode === "org") return plural ? "Workstreams" : "Workstream";
  return plural ? "Pods" : "Pod";
}

export function moderatorNoun(mode: string | null | undefined, plural = false): string {
  if (mode === "org") return plural ? "Co-leads" : "Co-lead";
  return plural ? "Poderators" : "Poderator";
}

/* StatusBadge variant for every cycle lifecycle state (SECTOR_MODEL §4).
   The admin surfaces previously kept partial maps (active/closed/draft only),
   so the real states `upcoming`/`closing`/`archived` fell through to the grey
   "inactive" look — a recruiting cohort read as dead. One shared mapping:
   upcoming is anticipatory like the member cycles page treats it, closing is
   still-alive teal, terminal states go grey. */
/* StatusBadge variant for workstream lifecycle states (active/dormant).
   Previously duplicated as identical local maps in workstreams-panel.tsx and
   workstreams-directory.tsx. */
export function workstreamStatusVariant(status: string): "active" | "inactive" {
  return status === "active" ? "active" : "inactive";
}

export function cycleStatusVariant(
  status: string
): "active" | "forming" | "inactive" | "draft" {
  switch (status) {
    case "active":
      return "active";
    case "upcoming":
    case "closing":
      return "forming";
    case "draft":
      return "draft";
    default: // closed, archived, anything legacy
      return "inactive";
  }
}
