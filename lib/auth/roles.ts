import { SupabaseClient } from "@supabase/supabase-js";
import { capabilitiesForRoles, type Permission } from "./permissions";

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

  const dbRoles: string[] = [];
  if (roleRows) {
    for (const r of roleRows) {
      dbRoles.push(r.role);
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

  // Capabilities are the UNION of what the participant's roles grant (the
  // unified model — caps follow roles for any new grant) and any legacy
  // per-person grants still in participant_permissions. The union guarantees
  // no capability regresses while participant_permissions is drained onto
  // roles (docs auth unification); revoking a role removes its derived caps,
  // and the /admin/access revoke also clears the matching legacy rows.
  const permSet = new Set<Permission>(capabilitiesForRoles(dbRoles));
  if (permRows) {
    for (const p of permRows) permSet.add(p.permission as Permission);
  }
  permissions.push(...permSet);

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

/**
 * True if the user is enrolled in the cycle and not revoked.
 *
 * Use this — not isActiveParticipant — to gate the pre-pod phases (problem
 * statement submission, problem-statement voting). Enrollment `status`
 * tracks pod-membership reality: self-service registration writes
 * 'inactive' by design, and the reconciler (lib/enrollment/reconciler.ts)
 * only flips it to 'active' once the participant has an active pod
 * membership — which cannot exist before pod registration (phase 3).
 * Gating phases 1–2 on status='active' therefore deadlocks every cycle
 * populated through the app: nobody can submit or vote, so pods are never
 * created, so nobody ever becomes 'active'.
 */
export function isEnrolledParticipant(roles: UserRoles, cycleId: number): boolean {
  return roles.cycleEnrollments.some(
    (e) => e.cycleId === cycleId && e.status !== "revoked"
  );
}
