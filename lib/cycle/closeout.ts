import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cycle close-out (SECTOR_MODEL.md §6, docs/LOCAL_LABS.md): the mechanic
 * behind "pods dissolve at the end of the cycle so poderators can focus on
 * the next cohort" and "projects are open source and global once the cycle
 * ends."
 *
 * On a cycle's transition to a terminal status ('archived', or the legacy
 * 'closed'), invoked from /api/cycles/[cycle_id]/status:
 *   - pods → status 'dissolved' (a governance flip, not a data wipe — rows,
 *     names, and history stay)
 *   - open pod_memberships stamped inactive_at; active moderator_assignments
 *     stamped removed_at (poderator/co-lead roles drop on next resolution)
 *   - projects still under cycle governance flip to governance='sector' and
 *     inherit the cycle's sector when it has one. A sector-less cycle's
 *     projects still flip (removing cycle/pod oversight — the DRIs become
 *     sole maintainers) but keep sector_id NULL: they surface in admin as
 *     needing a sector home rather than silently landing somewhere wrong.
 *
 * Idempotent: every write is filtered to rows not already in the target
 * state, so re-archiving (or a retried request) is a no-op.
 */

export interface CloseOutResult {
  podsDissolved: number;
  membershipsClosed: number;
  assignmentsRemoved: number;
  projectsGraduated: number;
  projectsNeedingSector: number;
}

export async function closeOutCycle(
  serviceClient: SupabaseClient,
  cycleId: number
): Promise<CloseOutResult> {
  const { data: cycle } = await serviceClient
    .from("cycles")
    .select("id, sector_id")
    .eq("id", cycleId)
    .maybeSingle();
  if (!cycle) {
    return {
      podsDissolved: 0,
      membershipsClosed: 0,
      assignmentsRemoved: 0,
      projectsGraduated: 0,
      projectsNeedingSector: 0,
    };
  }

  const now = new Date().toISOString();

  const { data: pods } = await serviceClient
    .from("pods")
    .select("id, status")
    .eq("cycle_id", cycleId);
  const podIds = (pods ?? []).map((p) => p.id);
  const undissolvedIds = (pods ?? [])
    .filter((p) => p.status !== "dissolved")
    .map((p) => p.id);

  let podsDissolved = 0;
  if (undissolvedIds.length > 0) {
    const { data } = await serviceClient
      .from("pods")
      .update({ status: "dissolved" })
      .in("id", undissolvedIds)
      .select("id");
    podsDissolved = data?.length ?? 0;
  }

  let membershipsClosed = 0;
  let assignmentsRemoved = 0;
  if (podIds.length > 0) {
    const { data: closedMemberships } = await serviceClient
      .from("pod_memberships")
      .update({ inactive_at: now })
      .in("pod_id", podIds)
      .is("inactive_at", null)
      .select("id");
    membershipsClosed = closedMemberships?.length ?? 0;

    const { data: removedAssignments } = await serviceClient
      .from("moderator_assignments")
      .update({ removed_at: now })
      .in("pod_id", podIds)
      .is("removed_at", null)
      .select("id");
    assignmentsRemoved = removedAssignments?.length ?? 0;
  }

  // Graduation: cycle governance ends here. The sector (when the cycle has
  // one) becomes the project's durable open-source home.
  const projectUpdate: Record<string, unknown> = { governance: "sector" };
  if (cycle.sector_id != null) projectUpdate.sector_id = cycle.sector_id;
  const { data: graduated } = await serviceClient
    .from("projects")
    .update(projectUpdate)
    .eq("cycle_id", cycleId)
    .eq("governance", "cycle")
    .select("id, sector_id");

  const projectsGraduated = graduated?.length ?? 0;
  const projectsNeedingSector = (graduated ?? []).filter(
    (p) => p.sector_id == null
  ).length;

  return {
    podsDissolved,
    membershipsClosed,
    assignmentsRemoved,
    projectsGraduated,
    projectsNeedingSector,
  };
}
