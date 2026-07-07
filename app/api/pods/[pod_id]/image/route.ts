import { NextResponse, type NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { handleImageUpload, handleImageDelete } from "@/lib/showcase/image";

/**
 * POST/DELETE /api/pods/[pod_id]/image?kind=logo|cover — the pod showcase
 * logo/cover. Curator gate + per-kind storage handling live in the shared
 * lib/showcase/image helper (see the two-image cleanup note there).
 */

export const POST = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    return handleImageUpload(request, auth, "pod", podId);
  }
);

export const DELETE = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    return handleImageDelete(request, auth, "pod", podId);
  }
);
