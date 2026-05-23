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
  const cycleEnrollments: UserRoles["cycleEnrollments"] = [];

  if (!participantId) {
    return { userId: authUserId, participantId, roles, permissions, moderatorPodIds, cycleEnrollments };
  }

  const [
    { data: userRoles },
    { data: permRows },
    { data: modAssignments },
    { data: enrollments },
  ] = await Promise.all([
    supabase.from("user_roles").select("role").eq("participant_id", participantId).is("revoked_at", null),
    supabase.from("participant_permissions").select("permission").eq("participant_id", participantId).is("revoked_at", null),
    supabase.from("moderator_assignments").select("pod_id").eq("participant_id", participantId).is("removed_at", null),
    supabase.from("cycle_enrollments").select("cycle_id, status").eq("participant_id", participantId),
  ]);

  if (userRoles) {
    for (const r of userRoles) {
      roles.push(r.role as Role);
    }
  }

  if (permRows) {
    for (const p of permRows) {
      permissions.push(p.permission as Permission);
    }
  }

  if (modAssignments && modAssignments.length > 0) {
    if (!roles.includes("moderator")) roles.push("moderator");
    for (const a of modAssignments) {
      moderatorPodIds.push(a.pod_id);
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

  return { userId: authUserId, participantId, roles, permissions, moderatorPodIds, cycleEnrollments };
}

/** Check if user has a specific permission */
export function can(roles: UserRoles, permission: Permission): boolean {
  return roles.permissions.includes(permission);
}

/** Backward-compatible: true if user can manage cycles (admin-level write access) */
export function isAdmin(roles: UserRoles): boolean {
  return can(roles, "cycles:write");
}

/** True if user can manage roles/permissions (owner-level) */
export function isOwner(roles: UserRoles): boolean {
  return can(roles, "roles:write");
}

/** True if user has moderator assignments */
export function isModerator(roles: UserRoles): boolean {
  return roles.moderatorPodIds.length > 0 || can(roles, "moderate:assigned_pods");
}

export function isModeratorForPod(roles: UserRoles, podId: number): boolean {
  return roles.moderatorPodIds.includes(podId);
}

export function isActiveParticipant(roles: UserRoles, cycleId: number): boolean {
  return roles.cycleEnrollments.some(
    (e) => e.cycleId === cycleId && e.status === "active"
  );
}
