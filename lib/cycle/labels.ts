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
