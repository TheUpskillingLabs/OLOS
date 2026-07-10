import { NextRequest, NextResponse } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import { requireProjectManagement } from "@/lib/auth/cycle-access";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

/**
 * DELETE /api/admin/projects/[project_id]/memberships/[participant_id]
 *
 * Admin/labs-lead override to remove a participant from a project (soft-delete
 * via left_at). Project-side twin of the pod membership delete. No enrollment
 * reconcile — enrollment status is pod-defined. Gated on pods:write + metro.
 */
export const DELETE = withPermissionAuth(
  "pods:write",
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    const client = createServiceClient();

    const { data: project } = await client
      .from("projects")
      .select("cycle_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const guard = await requireProjectManagement(auth.supabase, auth.user, projectId);
    if (guard) return guard;

    const { error } = await client
      .from("project_memberships")
      .update({ left_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("participant_id", participantId)
      .is("left_at", null);
    if (error) return dbError(error);

    return NextResponse.json({ success: true });
  }
);
