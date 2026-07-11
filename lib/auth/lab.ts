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

/** The lab a pod belongs to (null = HQ/global or not found). Reads the
 *  pod's own lab tag (pods.lab_id, 00067) — under the single HQ open cycle
 *  a pod's lab can no longer be derived from its cycle. */
export async function labForPod(podId: number): Promise<number | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("pods")
    .select("lab_id")
    .eq("id", podId)
    .maybeSingle();
  return data?.lab_id ?? null;
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

/**
 * Guard for cycle creation (POST /api/cycles). Admins create anything.
 * A lab lead may create ONLY their own lab's internal cycle: lab_id present,
 * mode 'org', and the lead must lead that lab (Decision 3, PRD-lab-lead-ux §9 —
 * labs are self-service).
 */
export function requireLabOrgCycleCreate(
  user: UserRoles,
  { mode, lab_id }: { mode: string; lab_id?: number }
): NextResponse | null {
  if (isAdmin(user)) return null;
  if (!lab_id || mode !== "org") {
    return NextResponse.json(
      {
        error:
          "HQ cycles are created by HQ admins. Lab leads create their own lab's internal cycle — include your lab_id with mode 'org'.",
      },
      { status: 403 }
    );
  }
  return requireLabAccess(user, lab_id);
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
