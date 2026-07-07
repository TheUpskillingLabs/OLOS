// Shared role → badge-color map. Previously copy-pasted into three admin
// surfaces (the global participants table, the cycle participants table, and —
// as a ring-variant — the permissions editor's preset buttons). One source now.

/** Tailwind classes for a role badge, keyed by role name. */
export const ROLE_BADGE_COLORS: Record<string, string> = {
  owner: "bg-ink/10 text-ink",
  admin: "bg-teal/10 text-teal-deep",
  developer: "bg-forest/10 text-forest",
  moderator: "bg-navy/10 text-navy",
  observer: "bg-ink/[0.04] text-meta",
};

/** Badge classes for a role, falling back to the neutral chip style. */
export function roleBadgeClass(role: string): string {
  return ROLE_BADGE_COLORS[role] ?? "bg-ink/[0.04] text-meta";
}
