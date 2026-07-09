import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isProjectDri } from "@/lib/auth/projects";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { addContributorSchema } from "@/lib/validations/workstreams";
import { createServiceClient } from "@/lib/supabase/server";
import { followPageSilently } from "@/lib/follows/seed";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// The IC ladder for a project (project_roles / project_subscriptions,
// migration 00060 / docs/ORG_CYCLES.md §2, §5). The project page reads the
// ladder server-side directly; this route is POST-only (add a contributor,
// gated to the project's DRIs + admins) plus DELETE (see [participant_id]).

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const body = await parseBody(request, addContributorSchema);
    if (isErrorResponse(body)) return body;
    const { participant_id, role } = body;

    const { data: project } = await auth.supabase
      .from("projects")
      .select("id, pod_id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const serviceClient = createServiceClient();

    const allowed = await isProjectDri(serviceClient, auth.user, projectId, project.pod_id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Only a project DRI or admin can add contributors." },
        { status: 403 }
      );
    }

    // project_roles writes are service-role-only (RLS) — the DRI check
    // above is the enforcement point.
    const { data: inserted, error } = await serviceClient
      .from("project_roles")
      .insert({
        participant_id,
        project_id: projectId,
        role,
        invited_by: auth.user.participantId,
      })
      .select("id, participant_id, project_id, role, invited_by, created_at")
      .single();

    if (error) {
      // 23505 = one_active_project_role — already an active role on this project.
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Already an active contributor or DRI on this project." },
          { status: 409 }
        );
      }
      return dbError(error, "project-contributors-add");
    }

    // New project member follows the project page so its updates reach their
    // feed (event-driven seed; a later manual unfollow sticks).
    await followPageSilently(serviceClient, participant_id, "project", projectId);

    return NextResponse.json(inserted, { status: 201 });
  }
);
