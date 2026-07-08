/**
 * Lab-scoped auth helpers (docs/LOCAL_LABS.md) — the lab tier's twin of
 * lib/auth/moderator.ts.
 *
 * Predicate: caller is admin/owner OR an active lead of the specific lab.
 * Admin ALWAYS short-circuits first, so relaxing a formerly admin-only
 * route with these helpers can never lock HQ out. HQ/global resources
 * (lab_id NULL) resolve to `null` lab and therefore stay admin-only for
 * everyone else — the relaxation only ever opens a lab's own rows to that
 * lab's leads.
 *
 * API routes use the NextResponse-returning guards; pages use
 * requireLabLead in lib/auth/guards.ts.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin, isLabLead, type UserRoles } from "./roles";

/**
 * Returns null if `user` may manage resources of lab `labId`, or a 403
 * NextResponse otherwise. `labId === null` means an HQ/global resource:
 * admins only.
 */
export function requireLabAccess(
  user: UserRoles,
  labId: number | null
): NextResponse | null {
  if (isAdmin(user)) return null;
  if (labId !== null && isLabLead(user, labId)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/** The lab a cycle belongs to (null = HQ/global or cycle not found). */
export async function labForCycle(cycleId: number): Promise<number | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("cycles")
    .select("lab_id")
    .eq("id", cycleId)
    .maybeSingle();
  return data?.lab_id ?? null;
}

/** The lab a pod belongs to, via its cycle (null = HQ/global or not found). */
export async function labForPod(podId: number): Promise<number | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pods")
    .select("cycle_id, cycles(lab_id)")
    .eq("id", podId)
    .maybeSingle();
  if (!data) return null;
  const cycle = data.cycles as { lab_id: number | null } | { lab_id: number | null }[] | null;
  const row = Array.isArray(cycle) ? cycle[0] : cycle;
  return row?.lab_id ?? null;
}

/** The lab a workstream belongs to (null = HQ/sector-homed or not found). */
export async function labForWorkstream(
  workstreamId: number
): Promise<number | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("workstreams")
    .select("lab_id")
    .eq("id", workstreamId)
    .maybeSingle();
  return data?.lab_id ?? null;
}

/** Resolve-and-check convenience for pod-addressed routes. */
export async function requireLabAccessForPod(
  user: UserRoles,
  podId: number
): Promise<NextResponse | null> {
  if (isAdmin(user)) return null;
  return requireLabAccess(user, await labForPod(podId));
}

/** Resolve-and-check convenience for cycle-addressed routes. */
export async function requireLabAccessForCycle(
  user: UserRoles,
  cycleId: number
): Promise<NextResponse | null> {
  if (isAdmin(user)) return null;
  return requireLabAccess(user, await labForCycle(cycleId));
}
