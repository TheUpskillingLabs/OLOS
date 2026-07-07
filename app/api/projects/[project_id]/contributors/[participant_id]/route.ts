import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isProjectDri } from "@/lib/auth/projects";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// Soft-remove a promoted IC (project_roles.removed_at) — migration 00060 /
// docs/ORG_CYCLES.md §5. Gated to the project's DRIs + admins, same as the
// add path. A DRI may remove themselves.

export const DELETE = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

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
        { error: "Only a project DRI or admin can remove contributors." },
        { status: 403 }
      );
    }

    const { data: activeRole } = await serviceClient
      .from("project_roles")
      .select("id, role")
      .eq("project_id", projectId)
      .eq("participant_id", participantId)
      .is("removed_at", null)
      .maybeSingle();

    if (!activeRole) {
      return NextResponse.json(
        { error: "Not an active contributor or DRI on this project." },
        { status: 404 }
      );
    }

    if (activeRole.role === "dri") {
      const { count: otherDriCount } = await serviceClient
        .from("project_roles")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("role", "dri")
        .is("removed_at", null)
        .neq("id", activeRole.id);

      if (!otherDriCount) {
        // Would removing this row leave the project with zero DRIs? Co-leads
        // on the pod still count as DRIs (lib/auth/projects.ts isProjectDri),
        // so this only bites sector-governed/orphaned projects whose pod has
        // no active moderators either.
        const { count: modCount } = await serviceClient
          .from("moderator_assignments")
          .select("id", { count: "exact", head: true })
          .eq("pod_id", project.pod_id)
          .is("removed_at", null);

        if (!modCount) {
          return NextResponse.json(
            { error: "A project must keep at least one DRI" },
            { status: 400 }
          );
        }
      }
    }

    const { data: removed, error } = await serviceClient
      .from("project_roles")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", activeRole.id)
      .is("removed_at", null)
      .select("participant_id, role, removed_at");

    if (error) {
      return dbError(error, "project-contributors-remove");
    }

    if (!removed || removed.length === 0) {
      return NextResponse.json(
        { error: "Not an active contributor or DRI on this project." },
        { status: 404 }
      );
    }

    return NextResponse.json(removed[0]);
  }
);
