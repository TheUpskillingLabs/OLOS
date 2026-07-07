import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isProjectDri } from "@/lib/auth/projects";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { addContributorSchema } from "@/lib/validations/workstreams";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// The IC ladder for a project (project_roles / project_subscriptions,
// migration 00060 / docs/ORG_CYCLES.md §2, §5). GET is public-read (the
// ladder is public); POST is gated to the project's DRIs + admins.

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const { data: roleRows, error } = await auth.supabase
      .from("project_roles")
      .select(`
        participant_id, role, created_at,
        participants (first_name, last_name, preferred_name)
      `)
      .eq("project_id", projectId)
      .is("removed_at", null)
      .order("created_at");

    if (error) {
      return dbError(error, "project-contributors-list");
    }

    const contributors = (roleRows || []).map((r) => {
      const p = (r.participants as unknown) as Record<string, unknown>;
      return {
        participant_id: r.participant_id,
        name: `${p?.preferred_name || p?.first_name || ""} ${p?.last_name || ""}`.trim(),
        role: r.role,
        created_at: r.created_at,
      };
    });

    // Aggregate follower count only — project_subscriptions RLS restricts
    // row-level reads to self + staff, but the total on a public project
    // page is a deliberate exception (same posture as public vote tallies).
    const { count: followerCount } = await createServiceClient()
      .from("project_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId);

    return NextResponse.json({
      contributors,
      follower_count: followerCount ?? 0,
    });
  }
);

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

    return NextResponse.json(inserted, { status: 201 });
  }
);
