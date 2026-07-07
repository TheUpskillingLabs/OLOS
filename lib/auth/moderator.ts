/**
 * Pod-scoped auth helper for the poderator dashboard.
 *
 * Consolidates the "is this user allowed to read/write this pod's
 * moderator-dashboard data?" check so every /api/moderator/pods/[pod_id]/*
 * route uses the same predicate.
 *
 * Predicate: caller is admin/owner OR has an active moderator assignment
 * for the pod (i.e. pod_id is in their UserRoles.moderatorPodIds).
 *
 * Returns null when allowed, a 403 NextResponse when denied — designed
 * to short-circuit handler logic:
 *
 *   const guard = requireModeratorForPod(auth.user, podId);
 *   if (guard) return guard;
 *
 * The base authentication + role resolution is already done by
 * `withAuth` (see lib/auth/middleware.ts); this helper layers the
 * per-pod authorization check on top.
 */

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { isAdmin, isModeratorForPod, type UserRoles } from "./roles";

/**
 * Returns null if `user` is allowed to access `podId`'s moderator data,
 * or a 403 NextResponse otherwise.
 *
 * Admins and owners are always allowed (they get global pod access per
 * PRD §8). Other users must have an active moderator assignment for the
 * specific pod.
 */
export function requireModeratorForPod(
  user: UserRoles,
  podId: number
): NextResponse | null {
  if (isAdmin(user)) return null;
  if (isModeratorForPod(user, podId)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * True if `user` is a poderator for any pod in `cycleId` (or an admin). Async
 * because moderator assignments are pod-scoped — UserRoles only carries pod
 * ids, so we resolve those pods' cycle here. Used to gate cycle-level survey
 * results/CSV for the assigned poderator.
 */
export async function isModeratorForCycle(
  user: UserRoles,
  cycleId: number
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (user.moderatorPodIds.length === 0) return false;
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("pods")
    .select("id", { head: true, count: "exact" })
    .in("id", user.moderatorPodIds)
    .eq("cycle_id", cycleId);
  return (count ?? 0) > 0;
}
