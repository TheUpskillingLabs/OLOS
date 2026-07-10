import { NextRequest, NextResponse } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import { requireCycleManagement } from "@/lib/auth/cycle-access";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { adminPodStatusSchema } from "@/lib/validations/admin-pod-status";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

/**
 * PATCH /api/admin/projects/[project_id]
 *
 * Admin/labs-lead project-status override — the project-side twin of
 * PATCH /api/admin/pods/[pod_id]. Allowed transitions: forming → active (the
 * use case), no-op on same status, reject active → forming (reversing an
 * activation is out of scope, same rationale as the pod route).
 *
 * Unlike the pod route, this does NOT reconcile enrollments: cycle_enrollments
 * status is defined by pod-membership reality, which a project status change
 * does not affect.
 *
 * Gated on pods:write + metro scope. #115 (no actor audit trail) applies here
 * too — deferred to the coordinated audit-column migration.
 */
export const PATCH = withPermissionAuth(
  "pods:write",
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const body = await parseBody(request, adminPodStatusSchema);
    if (isErrorResponse(body)) return body;
    const { status: newStatus } = body;

    const client = createServiceClient();

    const { data: project } = await client
      .from("projects")
      .select("id, cycle_id, status")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const guard = await requireCycleManagement(auth.supabase, auth.user, project.cycle_id);
    if (guard) return guard;

    if (project.status === newStatus) {
      return NextResponse.json({ project_id: project.id, status: project.status });
    }

    if (project.status === "active" && newStatus === "forming") {
      return NextResponse.json(
        { error: "Cannot revert an active project to forming." },
        { status: 400 }
      );
    }

    if (!(project.status === "forming" && newStatus === "active")) {
      return NextResponse.json(
        { error: `Unsupported transition: ${project.status} → ${newStatus}` },
        { status: 400 }
      );
    }

    const { error } = await client
      .from("projects")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) return dbError(error);

    return NextResponse.json({ project_id: project.id, status: "active" });
  }
);
