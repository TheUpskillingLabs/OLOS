export const PERMISSIONS = [
  "cycles:read",
  "cycles:write",
  "participants:read",
  "participants:write",
  "pods:read",
  "pods:write",
  "pulse_checks:read",
  "roles:read",
  "roles:write",
  "invitations:read",
  "invitations:write",
  "testing:use",
  "moderate:assigned_pods",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Cycles", permissions: ["cycles:read", "cycles:write"] },
  { label: "Participants", permissions: ["participants:read", "participants:write"] },
  { label: "Pods", permissions: ["pods:read", "pods:write"] },
  { label: "Pulse Checks", permissions: ["pulse_checks:read"] },
  { label: "Roles & Invitations", permissions: ["roles:read", "roles:write", "invitations:read", "invitations:write"] },
  { label: "Tools", permissions: ["testing:use"] },
  { label: "Moderator", permissions: ["moderate:assigned_pods"] },
];

export const ROLE_PRESETS: Record<string, Permission[]> = {
  owner: [...PERMISSIONS],
  admin: [
    "cycles:read", "cycles:write",
    "participants:read", "participants:write",
    "pods:read", "pods:write",
    "pulse_checks:read",
    "roles:read", "roles:write",
    "invitations:read", "invitations:write",
  ],
  developer: [
    "cycles:read", "cycles:write",
    "participants:read", "participants:write",
    "pods:read", "pods:write",
    "pulse_checks:read",
    "roles:read", "roles:write",
    "invitations:read", "invitations:write",
    "testing:use",
  ],
  // Metro-scoped local labs lead: manages the pod/project lifecycle for their
  // own region. Deliberately NOT granted cycles:write (config/schedule) or
  // roles:write — the lifecycle surfaces are gated on pods:write, and the
  // cycle-admin page hides the admin-only sections for this preset. Region
  // scoping is enforced via cycle.metro_slug (see lib/auth/cycle-access.ts).
  labs_lead: [
    "pods:read",
    "pods:write",
    "participants:read",
    "pulse_checks:read",
  ],
  moderator: [
    "pods:read",
    "pulse_checks:read",
    "moderate:assigned_pods",
  ],
  observer: [
    "cycles:read",
    "participants:read",
    "pods:read",
    "pulse_checks:read",
  ],
};

export const ROLE_PRESET_NAMES = Object.keys(ROLE_PRESETS) as (keyof typeof ROLE_PRESETS)[];

/**
 * Human-readable name for a role preset or role key. Handles the
 * underscore-carrying keys (e.g. `labs_lead` → "Labs Lead") that a naive
 * `charAt(0).toUpperCase()` would leave as "Labs_lead". Falls back to
 * title-casing each underscore-separated word, so it is safe for any
 * preset/role string.
 */
export function presetLabel(name: string): string {
  const overrides: Record<string, string> = {
    labs_lead: "Labs Lead",
  };
  if (overrides[name]) return overrides[name];
  return name
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function permissionLabel(permission: Permission): string {
  const labels: Record<Permission, string> = {
    "cycles:read": "View Cycles",
    "cycles:write": "Manage Cycles",
    "participants:read": "View Participants",
    "participants:write": "Manage Participants",
    "pods:read": "View All Pods",
    "pods:write": "Manage Pods",
    "pulse_checks:read": "View Pulse Checks",
    "roles:read": "View Roles",
    "roles:write": "Manage Roles",
    "invitations:read": "View Invitations",
    "invitations:write": "Manage Invitations",
    "testing:use": "Testing Tools",
    "moderate:assigned_pods": "Moderate Assigned Pods",
  };
  return labels[permission];
}

/** Determine which role presets are fully covered by a set of permissions */
export function activePresets(permissions: Permission[]): string[] {
  const set = new Set(permissions);
  return Object.entries(ROLE_PRESETS)
    .filter(([, perms]) => perms.every((p) => set.has(p)))
    .map(([name]) => name);
}
