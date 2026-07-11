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

/**
 * The capabilities each STORED participant_roles role carries (docs auth
 * unification). This is the authoritative role→capability definition the app
 * derives permissions from. Keyed by the DB role string (note `poderator`,
 * not the app label "moderator"). Roles absent here (staff, lab_lead,
 * co_lead, member, dri, contributor) carry no GLOBAL capabilities — their
 * authority is scoped and enforced by the scope guards (lib/auth/lab.ts,
 * lib/auth/projects.ts), not by a global permission.
 */
export const ROLE_CAPABILITIES: Record<string, Permission[]> = {
  owner: ROLE_PRESETS.owner,
  admin: ROLE_PRESETS.admin,
  developer: ROLE_PRESETS.developer,
  observer: ROLE_PRESETS.observer,
  poderator: ROLE_PRESETS.moderator,
  tester: ["testing:use"],
};

/** Union of the capabilities granted by a set of stored roles. */
export function capabilitiesForRoles(dbRoles: string[]): Permission[] {
  const set = new Set<Permission>();
  for (const r of dbRoles) {
    for (const p of ROLE_CAPABILITIES[r] ?? []) set.add(p);
  }
  return [...set];
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
