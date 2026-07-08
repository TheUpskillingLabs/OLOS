import { SupabaseClient } from "@supabase/supabase-js";
import type { Permission } from "./permissions";

export type Role = "owner" | "admin" | "observer" | "developer" | "moderator" | "participant";
export type ParticipantStatus = "active" | "inactive" | "revoked";

export interface UserRoles {
  userId: string;
  participantId: number | null;
  roles: Role[];
  permissions: Permission[];
  moderatorPodIds: number[];
  /** Labs (metros) this participant actively leads (lab_leads, 00062). */
  labLeadLabIds: number[];
  cycleEnrollments: {
    cycleId: number;
    status: ParticipantStatus;
  }[];
}

export async function resolveUserRoles(
  supabase: SupabaseClient,
  authUserId: string
): Promise<UserRoles> {
  // Get participant record
  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();

  const participantId = participant?.id ?? null;
  const roles: Role[] = [];
  const permissions: Permission[] = [];
  const moderatorPodIds: number[] = [];
  const labLeadLabIds: number[] = [];
  const cycleEnrollments: UserRoles["cycleEnrollments"] = [];

  if (!participantId) {
    return { userId: authUserId, participantId, roles, permissions, moderatorPodIds, labLeadLabIds, cycleEnrollments };
  }

  // Authority (roles + scoped assignments) resolves from participant_roles —
  // the SAME table the DB RLS is_admin()/is_owner() helpers read (00058), so
  // the app and the database agree on who is an admin/owner. This closes the
  // split-brain where post-00054 grants that landed only in user_roles /
  // participant_permissions were invisible to RLS (docs auth unification).
  // Granular capabilities (permissions[]) still read participant_permissions
  // for now — deriving them from roles is a later commit (once tester/
  // developer roles exist), so no holder of e.g. testing:use loses it here.
  const [
    { data: roleRows },
    { data: permRows },
    { data: enrollments },
  ] = await Promise.all([
    supabase.from("participant_roles").select("role, pod_id, lab_id").eq("participant_id", participantId).is("revoked_at", null),
    supabase.from("participant_permissions").select("permission").eq("participant_id", participantId).is("revoked_at", null),
    supabase.from("cycle_enrollments").select("cycle_id, status").eq("participant_id", participantId),
  ]);

  if (roleRows) {
    for (const r of roleRows) {
      switch (r.role) {
        case "owner":
        case "admin":
        case "observer":
        case "developer":
          if (!roles.includes(r.role as Role)) roles.push(r.role as Role);
          break;
        case "poderator":
          // Stored as "poderator"; the app label is "moderator".
          if (!roles.includes("moderator")) roles.push("moderator");
          if (r.pod_id != null) moderatorPodIds.push(r.pod_id);
          break;
        case "lab_lead":
          if (r.lab_id != null) labLeadLabIds.push(r.lab_id);
          break;
        default:
          // Member-preference roles (upskiller/…) and the project/flag roles
          // are not app authority roles resolved here.
          break;
      }
    }
  }

  if (permRows) {
    for (const p of permRows) {
      permissions.push(p.permission as Permission);
    }
  }

  if (enrollments) {
    for (const e of enrollments) {
      cycleEnrollments.push({ cycleId: e.cycle_id, status: e.status });
      if (e.status === "active") {
        if (!roles.includes("participant")) roles.push("participant");
      }
    }
  }

  return { userId: authUserId, participantId, roles, permissions, moderatorPodIds, labLeadLabIds, cycleEnrollments };
}

/** Check if user has a specific permission */
export function can(roles: UserRoles, permission: Permission): boolean {
  return roles.permissions.includes(permission);
}

/** True for admin-level access. Role-based so it matches the DB RLS
 *  is_admin() helper (00064) exactly — owner, admin, or developer (the
 *  developer preset is a superset of admin). */
export function isAdmin(roles: UserRoles): boolean {
  return (
    roles.roles.includes("owner") ||
    roles.roles.includes("admin") ||
    roles.roles.includes("developer")
  );
}

/** True for owner (super-admin). Role-based to match the DB RLS is_owner()
 *  helper exactly. */
export function isOwner(roles: UserRoles): boolean {
  return roles.roles.includes("owner");
}

/** True if user has moderator assignments */
export function isModerator(roles: UserRoles): boolean {
  return roles.moderatorPodIds.length > 0 || can(roles, "moderate:assigned_pods");
}

export function isModeratorForPod(roles: UserRoles, podId: number): boolean {
  return roles.moderatorPodIds.includes(podId);
}

/** True if user actively leads the given local lab (metro). */
export function isLabLead(roles: UserRoles, labId: number): boolean {
  return roles.labLeadLabIds.includes(labId);
}

/** True if user actively leads any local lab. */
export function isAnyLabLead(roles: UserRoles): boolean {
  return roles.labLeadLabIds.length > 0;
}

export function isActiveParticipant(roles: UserRoles, cycleId: number): boolean {
  return roles.cycleEnrollments.some(
    (e) => e.cycleId === cycleId && e.status === "active"
  );
}
