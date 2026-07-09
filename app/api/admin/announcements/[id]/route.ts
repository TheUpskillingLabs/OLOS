import { NextRequest, NextResponse } from "next/server";
import {
  withAdminAuth,
  type AuthenticatedRequest,
} from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { announcementPatchSchema } from "@/lib/validations/announcement";

// Edit / publish / archive an announcement (PATCH) or drop it (DELETE). All
// service-role, admin-gated. Publishing stamps published_at once (kept once
// set — mirrors the spotlight publish contract).
export const PATCH = withAdminAuth(
  async (
    request: NextRequest,
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const body = await parseBody(request, announcementPatchSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const update: Record<string, unknown> = { ...body };

    if (body.status === "published") {
      const { data: current } = await service
        .from("announcements")
        .select("id, published_at")
        .eq("id", id)
        .maybeSingle();
      if (!current) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (!current.published_at) {
        update.published_at = new Date().toISOString();
      }
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

export const DELETE = withAdminAuth(
  async (
    _request: NextRequest,
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const service = createServiceClient();
    const { error } = await service.from("announcements").delete().eq("id", id);
    if (error) return dbError(error, "announcement-delete");
    return NextResponse.json({ deleted: true });
  }
);
