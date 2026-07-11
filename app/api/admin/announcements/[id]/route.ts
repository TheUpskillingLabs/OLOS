import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { requireLabAccess } from "@/lib/auth/lab";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { announcementPatchSchema } from "@/lib/validations/announcement";

// Edit / publish / archive an announcement (PATCH) or drop it (DELETE).
// Service-role writes, authorized by requireLabAccess against the row's CURRENT
// lab (admin → any; lab lead → only their labs; org-wide → admin-only). PATCH
// re-checks the NEW lab_id too, so a lab lead can't move a row to another lab
// or org-wide. Publishing stamps published_at once (kept once set).
export const PATCH = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const body = await parseBody(request, announcementPatchSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const { data: current } = await service
      .from("announcements")
      .select("id, lab_id, published_at")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Must have access to the row's current lab...
    const guard = requireLabAccess(auth.user, current.lab_id);
    if (guard) return guard;
    // ...and, if the audience is being changed, to the new lab as well.
    if (body.lab_id !== undefined) {
      const guardNew = requireLabAccess(auth.user, body.lab_id ?? null);
      if (guardNew) return guardNew;
    }

    const update: Record<string, unknown> = { ...body };
    if (body.status === "published" && !current.published_at) {
      update.published_at = new Date().toISOString();
    }

    const { data, error } = await service
      .from("announcements")
      .update(update)
      .eq("id", id)
      .select("id, status")
      .single();
    if (error) return dbError(error, "announcement-update");
    return NextResponse.json(data);
  }
);

export const DELETE = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const service = createServiceClient();
    const { data: current } = await service
      .from("announcements")
      .select("id, lab_id")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const guard = requireLabAccess(auth.user, current.lab_id);
    if (guard) return guard;

    const { error } = await service.from("announcements").delete().eq("id", id);
    if (error) return dbError(error, "announcement-delete");
    return NextResponse.json({ deleted: true });
  }
);
