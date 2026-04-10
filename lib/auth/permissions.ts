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
