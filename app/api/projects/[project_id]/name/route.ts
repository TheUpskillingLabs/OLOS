import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { nameUpdateSchema } from "@/lib/validations/pods";

export const PATCH = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    // Get project to check pod for moderator access
    const { data: project } = await auth.supabase
      .from("projects")
      .select("pod_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!isAdmin(auth.user) && !auth.user.moderatorPodIds.includes(project.pod_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await parseBody(request, nameUpdateSchema);
    if (isErrorResponse(body)) return body;
    const { name } = body;

    const { data, error } = await auth.supabase
      .from("projects")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("id, name, updated_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
