import { NextResponse, NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { isAdmin, isModerator } from "@/lib/auth/roles";
import { getPodsForUser } from "@/lib/moderator/pods-list";

/**
 * GET /api/moderator/pods
 *
 * Backs the All pods view (§7.10.1 pod summary cards + §7.10.2 rollup).
 *
 * Returns one row per pod the caller can access:
 *   - admin/owner → all pods, all cycles
 *   - moderator → only pods with an active moderator_assignment
 *
 * Shape of each row is `PodCard` in lib/moderator/pods-list.ts. The RSC
 * page calls `getPodsForUser` directly; this endpoint exists for
 * client-side consumers (e.g. future polling or refresh actions).
 */
export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    if (!isModerator(auth.user) && !isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const cards = await getPodsForUser(auth.supabase, auth.user);
    return NextResponse.json(cards);
  }
);
