import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auto-follow the pages you belong to, two ways:
 *   • ensurePageFollowsSeeded — a one-time backfill on dashboard load
 *     (migration 00076's `page_follows_seeded`): lab, active pods, their
 *     workstreams, projects, and the member's sector.
 *   • followPageSilently — event-driven: called at membership-creation points
 *     (pod join, project contributor add, lab join) so pages gained AFTER the
 *     backfill are followed too. Fires once per membership event, so a later
 *     manual unfollow is never overridden.
 * Both are best-effort — never throw into the caller's path.
 */

/** Idempotent single-page follow — the event-driven seeding primitive. */
export async function followPageSilently(
  service: SupabaseClient,
  participantId: number,
  pageType: "lab" | "sector" | "workstream" | "pod" | "project",
  pageId: number
): Promise<void> {
  try {
    const { error } = await service.from("follows").insert({
      follower_participant_id: participantId,
      page_type: pageType,
      page_id: pageId,
    });
    // 23505 = already following — fine.
    if (error && error.code !== "23505") {
      console.error("[follows] silent page follow failed:", error.message);
    }
  } catch (e) {
    console.error("[follows] silent page follow failed:", e);
  }
}
export async function ensurePageFollowsSeeded(
  service: SupabaseClient,
  participant: {
    id: number;
    metro_id: number | null;
    page_follows_seeded?: boolean | null;
  }
): Promise<void> {
  if (participant.page_follows_seeded) return;
  try {
    const targets: { page_type: string; page_id: number }[] = [];

    if (participant.metro_id != null) {
      targets.push({ page_type: "lab", page_id: participant.metro_id });
    }

    // Active pod memberships → follow the pods (and their workstream runs).
    const { data: pods } = await service
      .from("pod_memberships")
      .select("pod_id, pods!inner(id, workstream_id)")
      .eq("participant_id", participant.id)
      .is("inactive_at", null);
    const wsIds = new Set<number>();
    for (const row of pods ?? []) {
      targets.push({ page_type: "pod", page_id: row.pod_id as number });
      const pod = Array.isArray(row.pods) ? row.pods[0] : row.pods;
      if (pod?.workstream_id != null) wsIds.add(pod.workstream_id as number);
    }
    for (const wsId of wsIds) {
      targets.push({ page_type: "workstream", page_id: wsId });
    }

    // Active project roles → follow the projects.
    const { data: projRoles } = await service
      .from("project_roles")
      .select("project_id")
      .eq("participant_id", participant.id)
      .is("removed_at", null);
    for (const r of projRoles ?? []) {
      targets.push({ page_type: "project", page_id: r.project_id as number });
    }

    // Active cycle enrollments → follow the cycles' sectors (the left rail
    // shows the sector as an open-cycle member's org unit, so its page posts
    // should reach them).
    const { data: enrollments } = await service
      .from("cycle_enrollments")
      .select("cycles!inner(sector_id)")
      .eq("participant_id", participant.id)
      .eq("status", "active");
    const sectorIds = new Set<number>();
    for (const row of enrollments ?? []) {
      const cycle = Array.isArray(row.cycles) ? row.cycles[0] : row.cycles;
      if (cycle?.sector_id != null) sectorIds.add(cycle.sector_id as number);
    }
    for (const sid of sectorIds) {
      targets.push({ page_type: "sector", page_id: sid });
    }

    if (targets.length > 0) {
      // Skip pages they already follow so a batch insert never hits the unique.
      const { data: existing } = await service
        .from("follows")
        .select("page_type, page_id")
        .eq("follower_participant_id", participant.id)
        .not("page_type", "is", null);
      const have = new Set(
        (existing ?? []).map((e) => `${e.page_type}:${e.page_id}`)
      );
      const fresh = targets.filter(
        (t) => !have.has(`${t.page_type}:${t.page_id}`)
      );
      if (fresh.length > 0) {
        const { error } = await service.from("follows").insert(
          fresh.map((t) => ({
            follower_participant_id: participant.id,
            page_type: t.page_type,
            page_id: t.page_id,
          }))
        );
        if (error) {
          console.error("[follows] page seed insert failed:", error.message);
        }
      }
    }

    await service
      .from("participants")
      .update({ page_follows_seeded: true })
      .eq("id", participant.id);
  } catch (e) {
    console.error("[follows] page seed failed:", e);
  }
}
