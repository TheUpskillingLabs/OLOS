import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
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

    // Authorization is enforced above (admin or the owning pod's moderator).
    // The write runs on the service client because the projects_update RLS
    // policy requires is_admin_or_owner(); a moderator would otherwise match
    // 0 rows and .single() would 500 (audit fix).
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
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
