import { NextResponse, NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireModeratorForPod } from "@/lib/auth/moderator";
import { parseIntParam } from "@/lib/api/params";
import { getPodDetail } from "@/lib/moderator/pod-detail";

/**
 * GET /api/moderator/pods/[pod_id]
 *
 * Backs the Per-pod view (§7.1 status header + §7.3 member roster).
 * The RSC at app/(dashboard)/moderator/pods/[pod_id]/page.tsx calls
 * `getPodDetail` directly; this endpoint exists for client-side
 * consumers (refresh actions, future polling).
 *
 * Pod-scoped: requires admin OR active moderator assignment for this pod.
 */
export const GET = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const guard = requireModeratorForPod(auth.user, podId);
    if (guard) return guard;

    const detail = await getPodDetail(auth.supabase, podId);
    if (!detail) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  }
);
