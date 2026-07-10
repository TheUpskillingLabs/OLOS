import { NextRequest, NextResponse } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import { requireCycleManagement } from "@/lib/auth/cycle-access";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { adminAddPodMembershipSchema } from "@/lib/validations/admin-pod-membership";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

/**
 * POST /api/admin/projects/[project_id]/memberships  { participant_id }
 *
 * Admin/labs-lead override to place a participant into a project on their
 * behalf — the project-side twin of the pod membership route. Reactivation-aware
 * (clears left_at), enforces the 1-project-per-cycle cap, and auto-activates the
 * project when it reaches project_min. Gated on pods:write + metro scope.
 *
 * #115 (no actor audit trail) applies — deferred to the coordinated migration.
 */
export const POST = withPermissionAuth(
  "pods:write",
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const body = await parseBody(request, adminAddPodMembershipSchema);
    if (isErrorResponse(body)) return body;
    const { participant_id } = body;

    const client = createServiceClient();

    const { data: project } = await client
      .from("projects")
      .select("id, pod_id, cycle_id, status")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const guard = await requireCycleManagement(auth.supabase, auth.user, project.cycle_id);
    if (guard) return guard;

    // 1-project-per-cycle cap (active memberships only).
    const { data: existingElsewhere } = await client
      .from("project_memberships")
      .select("id, project_id")
      .eq("participant_id", participant_id)
      .eq("cycle_id", project.cycle_id)
      .is("left_at", null)
      .maybeSingle();
    if (existingElsewhere && existingElsewhere.project_id !== projectId) {
      return NextResponse.json(
        { error: "Participant is already registered in a project for this cycle." },
        { status: 400 }
      );
    }

    // Reactivation-aware write (UNIQUE(participant_id, project_id)).
    const { data: existing } = await client
      .from("project_memberships")
      .select("id, left_at")
      .eq("project_id", projectId)
      .eq("participant_id", participant_id)
      .maybeSingle();

    if (existing && existing.left_at === null) {
      return NextResponse.json(
        { error: "Participant is already registered for this project." },
        { status: 400 }
      );
    }

    if (existing) {
      const { error } = await client
        .from("project_memberships")
        .update({ left_at: null })
        .eq("id", existing.id);
      if (error) return dbError(error);
    } else {
      const { error } = await client
        .from("project_memberships")
        .insert({ participant_id, project_id: projectId, cycle_id: project.cycle_id });
      if (error) return dbError(error);
    }

    // Auto-activate at project_min.
    const { data: config } = await client
      .from("cycle_config")
      .select("project_min")
      .eq("cycle_id", project.cycle_id)
      .single();
    const { count } = await client
      .from("project_memberships")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("left_at", null);
    if (config && count && count >= config.project_min && project.status === "forming") {
      await client
        .from("projects")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", projectId)
        .eq("status", "forming");
    }

    return NextResponse.json({ success: true }, { status: 201 });
  }
);
