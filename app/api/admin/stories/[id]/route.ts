import { NextRequest, NextResponse } from "next/server";
import {
  withAdminAuth,
  type AuthenticatedRequest,
} from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { spotlightAdminSchema } from "@/lib/validations/spotlight-admin";
import { slugifyHandle } from "@/lib/participants/handle";

// Admin review of a spotlight (the /admin/stories surface). PATCH edits the
// editorial fields and flips status; publishing stamps published_at and
// derives a unique slug from the name (the #s-{slug} deep-link contract).
// DELETE drops a submission. All service-role, admin-gated.

export const PATCH = withAdminAuth(
  async (
    request: NextRequest,
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const body = await parseBody(request, spotlightAdminSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const update: Record<string, unknown> = { ...body };

    // Publishing: stamp published_at and ensure a slug (once set, keep it).
    if (body.status === "published") {
      const { data: current } = await service
        .from("spotlights")
        .select("id, name, slug")
        .eq("id", id)
        .maybeSingle();
      if (!current) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      update.published_at = new Date().toISOString();
      if (!current.slug) {
        const base = slugifyHandle(body.name ?? current.name);
        const { data: clash } = await service
          .from("spotlights")
          .select("id")
          .eq("slug", base)
          .neq("id", id)
          .maybeSingle();
        update.slug = clash ? `${base}-${id}` : base;
      }
    }

    const { data, error } = await service
      .from("spotlights")
      .update(update)
      .eq("id", id)
      .select("id, status, slug")
      .single();
    if (error) return dbError(error, "spotlight-admin");
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
    const { error } = await service.from("spotlights").delete().eq("id", id);
    if (error) return dbError(error, "spotlight-delete");
    return NextResponse.json({ deleted: true });
  }
);
