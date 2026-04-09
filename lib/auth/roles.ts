import { SupabaseClient } from "@supabase/supabase-js";

export type Role = "owner" | "admin" | "observer" | "moderator" | "participant";
export type ParticipantStatus = "active" | "inactive" | "revoked";

export interface UserRoles {
  userId: string;
  participantId: number | null;
  roles: Role[];
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
  const moderatorPodIds: number[] = [];
  const cycleEnrollments: UserRoles["cycleEnrollments"] = [];

  if (!participantId) {
    return { userId: authUserId, participantId, roles, moderatorPodIds, cycleEnrollments };
  }

  // Get elevated roles (owner, admin, observer)
  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("participant_id", participantId)
    .is("revoked_at", null);

  if (userRoles) {
    for (const r of userRoles) {
      roles.push(r.role as Role);
    }
  }

  // Get moderator assignments
  const { data: modAssignments } = await supabase
    .from("moderator_assignments")
    .select("pod_id")
    .eq("participant_id", participantId)
    .is("removed_at", null);

  if (modAssignments && modAssignments.length > 0) {
    roles.push("moderator");
    for (const a of modAssignments) {
      moderatorPodIds.push(a.pod_id);
    }
  }

  // Get cycle enrollments
  const { data: enrollments } = await supabase
    .from("cycle_enrollments")
    .select("cycle_id, status")
    .eq("participant_id", participantId);

  if (enrollments) {
    for (const e of enrollments) {
      cycleEnrollments.push({ cycleId: e.cycle_id, status: e.status });
      if (e.status === "active") {
        if (!roles.includes("participant")) roles.push("participant");
      }
    }
  }

  return { userId: authUserId, participantId, roles, moderatorPodIds, cycleEnrollments };
}

export function isAdmin(roles: UserRoles): boolean {
  return roles.roles.includes("admin") || roles.roles.includes("owner");
}

export function isModerator(roles: UserRoles): boolean {
  return roles.roles.includes("moderator");
}

export function isModeratorForPod(roles: UserRoles, podId: number): boolean {
  return roles.moderatorPodIds.includes(podId);
}

export function isActiveParticipant(roles: UserRoles, cycleId: number): boolean {
  return roles.cycleEnrollments.some(
    (e) => e.cycleId === cycleId && e.status === "active"
  );
}
