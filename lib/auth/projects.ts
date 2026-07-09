import { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, isModeratorForPod, type UserRoles } from "./roles";

/**
 * True when `userRoles` is a DRI (Directly Responsible Individual) for
 * `projectId`, whose pod is `podId`. The DRI set for a project is the
 * workstream's co-leads plus anyone they've promoted (SECTOR_MODEL §5,
 * docs/ORG_CYCLES.md): admins, moderators of the project's pod (co-leads),
 * or anyone holding an active `project_roles` row with role='dri' on this
 * project.
 */
export async function isProjectDri(
  serviceClient: SupabaseClient,
  userRoles: UserRoles,
  projectId: number,
  podId: number
): Promise<boolean> {
  if (isAdmin(userRoles)) return true;
  if (isModeratorForPod(userRoles, podId)) return true;

  const participantId = userRoles.participantId;
  if (!participantId) return false;

  const { data } = await serviceClient
    .from("project_roles")
    .select("id")
    .eq("project_id", projectId)
    .eq("participant_id", participantId)
    .eq("role", "dri")
    .is("removed_at", null)
    .maybeSingle();

  return !!data;
}

/**
 * True when `userRoles` is a member OR maintainer of `projectId` (whose pod is
 * `podId`) — the broader set that admins the project page: admins, co-leads of
 * its pod, or anyone holding ANY active `project_roles` row (dri OR
 * contributor). Used for "post as this project" — a project is run by all its
 * members/maintainers, not only its DRI.
 */
export async function isProjectMember(
  serviceClient: SupabaseClient,
  userRoles: UserRoles,
  projectId: number,
  podId: number
): Promise<boolean> {
  if (isAdmin(userRoles)) return true;
  if (isModeratorForPod(userRoles, podId)) return true;

  const participantId = userRoles.participantId;
  if (!participantId) return false;

  const { data } = await serviceClient
    .from("project_roles")
    .select("id")
    .eq("project_id", projectId)
    .eq("participant_id", participantId)
    .is("removed_at", null)
    .maybeSingle();

  return !!data;
}
