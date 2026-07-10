import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { can, type UserRoles } from "./roles";

/** The minimal cycle shape the scope checks need. */
export type CycleScope = { id?: number; metro_slug: string | null };

/** Can the user manage the pod/project lifecycle at all? (pods:write) */
export function canManageLifecycle(roles: UserRoles): boolean {
  return can(roles, "pods:write");
}

/** Full cycle admin — config, schedule, participants, revocations. (cycles:write) */
export function isFullCycleAdmin(roles: UserRoles): boolean {
  return can(roles, "cycles:write");
}

/**
 * Can the user manage THIS cycle's lifecycle?
 *   - Full admins/owners (cycles:write) → any cycle.
 *   - Metro-scoped labs leads (pods:write, not cycles:write) → only cycles in
 *     their own metro (both the cycle and the lead must carry a metro, and they
 *     must match). A cycle with no metro is manageable only by full admins.
 *
 * This is the single server-side gate every lifecycle route must call after
 * loading the target's cycle — page-level hiding is not sufficient.
 */
export function canManageCycle(roles: UserRoles, cycle: CycleScope): boolean {
  if (!canManageLifecycle(roles)) return false;
  if (isFullCycleAdmin(roles)) return true;
  return (
    !!cycle.metro_slug &&
    !!roles.metroSlug &&
    cycle.metro_slug === roles.metroSlug
  );
}

/** Filter a list of cycles to those the user may manage. */
export function scopeCyclesForUser<T extends CycleScope>(
  roles: UserRoles,
  cycles: T[]
): T[] {
  if (isFullCycleAdmin(roles)) return cycles;
  if (!canManageLifecycle(roles)) return [];
  return cycles.filter(
    (c) => !!c.metro_slug && !!roles.metroSlug && c.metro_slug === roles.metroSlug
  );
}

/**
 * Route guard: the caller already passed a `pods:write` permission gate; this
 * enforces the metro scope for the target cycle. Loads the cycle's metro and
 * returns a NextResponse (404/403) to short-circuit, or null to proceed. Call
 * from every lifecycle route after resolving the target's cycle id.
 */
export async function requireCycleManagement(
  supabase: SupabaseClient,
  roles: UserRoles,
  cycleId: number
): Promise<NextResponse | null> {
  const { data: cycle } = await supabase
    .from("cycles")
    .select("id, metro_slug")
    .eq("id", cycleId)
    .maybeSingle();
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  if (!canManageCycle(roles, cycle)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
