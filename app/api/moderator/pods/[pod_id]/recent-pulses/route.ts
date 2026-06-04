import { NextResponse, NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireModeratorForPod } from "@/lib/auth/moderator";
import { parseIntParam } from "@/lib/api/params";
import {
  getRecentPulses,
  RECENT_PULSES_PAGE_SIZE,
} from "@/lib/moderator/recent-pulses";

/**
 * GET /api/moderator/pods/[pod_id]/recent-pulses
 *
 * Backs the "Recent pulses" tab on the per-pod page (chunk B of the
 * 2026-06 poderator-dashboard refinement).
 *
 * Query params:
 *   - before  (optional ISO timestamp) — return pulses completed strictly
 *             before this value, used for paging older.
 *   - limit   (optional int) — page size; clamped to [1, 50].
 *
 * Auth: same as the other /api/moderator/pods/[pod_id]/* routes — admin
 * or active moderator for the pod.
 */
export const GET = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const guard = requireModeratorForPod(auth.user, podId);
    if (guard) return guard;

    const url = new URL(request.url);
    const before = url.searchParams.get("before");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam
      ? Number.parseInt(limitParam, 10)
      : RECENT_PULSES_PAGE_SIZE;

    const result = await getRecentPulses(auth.supabase, podId, {
      before: before && before.length > 0 ? before : null,
      limit: Number.isFinite(limit) ? limit : RECENT_PULSES_PAGE_SIZE,
    });
    if ("error" in result) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  }
);
