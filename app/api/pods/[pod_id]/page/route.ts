import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { createServiceClient } from "@/lib/supabase/server";
import { showcasePageSchema } from "@/lib/validations/showcase";
import { resolveEntityCurator } from "@/lib/showcase/curator";

/**
 * PATCH /api/pods/[pod_id]/page — update showcase-page fields (tagline,
 * description, directory_visible). Curator-gated (admin OR the pod's Poderator).
 * A separate file from name/route.ts to avoid the collision-prone pods surface.
 * logo_url / cover_url are NOT settable here — those go through the image route.
 * Authz happens at the app layer, so the write uses the service client.
 */
export const PATCH = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const guard = await resolveEntityCurator(auth.user, "pod", podId, auth.supabase);
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
      .from("pods")
      .update(update)
      .eq("id", podId)
      .select("id, tagline, description, directory_visible, updated_at")
      .single();
    if (error) return dbError(error, "pod-page-update");

    return NextResponse.json(data);
  }
);
