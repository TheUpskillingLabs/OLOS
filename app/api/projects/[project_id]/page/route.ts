import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { showcasePageSchema } from "@/lib/validations/showcase";
import { resolveEntityCurator } from "@/lib/showcase/curator";

/**
 * PATCH /api/projects/[project_id]/page — update showcase-page fields (tagline,
 * description, directory_visible). Curator-gated (admin OR the parent pod's
 * Poderator, resolved inside resolveEntityCurator). Sibling to name/route.ts.
 * logo_url / cover_url go through the image route, not here.
 */
export const PATCH = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const guard = await resolveEntityCurator(
      auth.user,
      "project",
      projectId,
      auth.supabase
    );
    if (guard) return guard;

    const body = await parseBody(request, showcasePageSchema);
    if (isErrorResponse(body)) return body;

    const update: Record<string, unknown> = {};
    if (body.tagline !== undefined) update.tagline = body.tagline;
    if (body.description !== undefined) update.description = body.description;
    if (body.directory_visible !== undefined)
      update.directory_visible = body.directory_visible;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("projects")
      .update(update)
      .eq("id", projectId)
      .select("id, tagline, description, directory_visible, updated_at")
      .single();
    if (error) return dbError(error, "project-page-update");

    return NextResponse.json(data);
  }
);
