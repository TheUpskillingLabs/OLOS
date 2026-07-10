import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { can, type UserRoles } from "./roles";

/**
 * HQ / Local-Lab access model.
 *
 * Cycles are centrally coordinated by HQ. The lab boundary lives on the
 * pod/project (and, for a lab's own cycle, on the cycle), never implicitly on
 * a shared HQ cycle. Three cycle kinds, from `metro_slug` + `is_hq_internal`:
 *   - HQ-open:      metro_slug NULL, !is_hq_internal — every lab participates.
 *   - Local-lab:    metro_slug = <metro>            — that one lab's own cycle.
 *   - HQ-internal:  is_hq_internal = true            — HQ org/structure cycle.
 *
 * Full admins/owners (`cycles:write`) bypass every metro check. Labs leads hold
 * `pods:write` (not `cycles:write`) and carry `roles.metroSlug`; they:
 *   - SEE HQ-open cycles + their own lab's cycles (canSeeCycle),
 *   - CONFIGURE only their own lab's cycles (canConfigureCycle),
 *   - MANAGE only pods/projects whose metro is theirs (canManageEntity).
 */

/** The minimal cycle shape the taxonomy checks need. */
export type CycleScope = { metro_slug: string | null; is_hq_internal?: boolean | null };

/** The minimal pod/project shape the ownership check needs. */
export type EntityScope = { metro_slug: string | null };

/** Can the user touch the pod/project lifecycle at all? (pods:write) */
export function canManageLifecycle(roles: UserRoles): boolean {
  return can(roles, "pods:write");
}

/** Full HQ admin — configures any cycle, sees everything. (cycles:write) */
export function isFullCycleAdmin(roles: UserRoles): boolean {
  return can(roles, "cycles:write");
}

/**
 * May the user SEE this cycle in their admin surfaces?
 *   - Full admins: any cycle.
 *   - Everyone else with lifecycle access: HQ-open cycles (no metro, not
 *     internal) and their own lab's cycles. Never other labs' cycles, never
 *     HQ-internal/org cycles.
 */
export function canSeeCycle(roles: UserRoles, cycle: CycleScope): boolean {
  if (isFullCycleAdmin(roles)) return true;
  if (!canManageLifecycle(roles)) return false;
  if (cycle.is_hq_internal) return false;
  return cycle.metro_slug === null || cycle.metro_slug === roles.metroSlug;
}

/**
 * May the user CONFIGURE this cycle (status/schedule/params/details/create)?
 *   - Full admins: any cycle.
 *   - Labs leads: only their OWN lab's cycle (metro matches, not internal).
 *     They never configure a shared HQ-open cycle or an HQ-internal cycle.
 */
export function canConfigureCycle(roles: UserRoles, cycle: CycleScope): boolean {
  if (isFullCycleAdmin(roles)) return true;
  if (!canManageLifecycle(roles)) return false;
  return (
    !cycle.is_hq_internal &&
    !!cycle.metro_slug &&
    !!roles.metroSlug &&
    cycle.metro_slug === roles.metroSlug
  );
}

/**
 * May the user MANAGE this pod or project (finalize, rename, status,
 * membership, moderators)?
 *   - Full admins: any pod/project.
 *   - Labs leads: only entities whose metro is theirs. A metro-less (HQ/legacy)
 *     pod/project is manageable only by full admins.
 */
export function canManageEntity(roles: UserRoles, entity: EntityScope): boolean {
  if (isFullCycleAdmin(roles)) return true;
  if (!canManageLifecycle(roles)) return false;
  return (
    !!entity.metro_slug &&
    !!roles.metroSlug &&
    entity.metro_slug === roles.metroSlug
  );
}

/** Filter a list of cycles to those the user may see. */
export function scopeCyclesForUser<T extends CycleScope>(
  roles: UserRoles,
  cycles: T[]
): T[] {
  if (isFullCycleAdmin(roles)) return cycles;
  if (!canManageLifecycle(roles)) return [];
  return cycles.filter((c) => canSeeCycle(roles, c));
}

/**
 * Route guard for pod-scoped lifecycle routes: the caller already passed a
 * `pods:write` gate; this enforces the lab boundary for the target pod. Loads
 * the pod's metro and returns a NextResponse (404/403) to short-circuit, or
 * null to proceed. Call after resolving the pod id.
 */
export async function requirePodManagement(
  supabase: SupabaseClient,
  roles: UserRoles,
  podId: number
): Promise<NextResponse | null> {
  const { data: pod } = await supabase
    .from("pods")
    .select("id, metro_slug")
    .eq("id", podId)
    .maybeSingle();
  if (!pod) return NextResponse.json({ error: "Pod not found" }, { status: 404 });
  if (!canManageEntity(roles, pod)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/** Route guard for project-scoped lifecycle routes. Mirrors requirePodManagement. */
export async function requireProjectManagement(
  supabase: SupabaseClient,
  roles: UserRoles,
  projectId: number
): Promise<NextResponse | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("id, metro_slug")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!canManageEntity(roles, project)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Route guard for cycle-CONFIG routes (create is handled inline). The caller
 * passed a `pods:write` gate; this enforces that a labs lead may only configure
 * their own lab's cycle, while full admins configure any. Loads the cycle's
 * metro + internal flag.
 */
export async function requireCycleConfig(
  supabase: SupabaseClient,
  roles: UserRoles,
  cycleId: number
): Promise<NextResponse | null> {
  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, metro_slug, is_hq_internal")
    .eq("id", cycleId)
    .maybeSingle();
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  if (!canConfigureCycle(roles, cycle)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
