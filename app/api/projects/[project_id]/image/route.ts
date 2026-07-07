import { NextResponse, type NextRequest } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { handleImageUpload, handleImageDelete } from "@/lib/showcase/image";

/**
 * POST/DELETE /api/projects/[project_id]/image?kind=logo|cover — the project
 * showcase logo/cover. Shared handler enforces the parent-pod curator gate.
 */

export const POST = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;
    return handleImageUpload(request, auth, "project", projectId);
  }
);

export const DELETE = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;
    return handleImageDelete(request, auth, "project", projectId);
  }
);
