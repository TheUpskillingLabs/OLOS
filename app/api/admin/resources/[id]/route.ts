import { NextRequest, NextResponse } from "next/server";
import {
  withAdminAuth,
  type AuthenticatedRequest,
} from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { resourceUpdateSchema } from "@/lib/validations/resource-admin";

// Edit / publish-toggle / delete a Learning Library resource. Admin-gated,
// service-role. PATCH sends only changed fields (status flips publish/draft);
// the resources updated_at trigger (00037) stamps the timestamp. DELETE drops
// the row — saved_items rows referencing it are cleaned up by the caller's
// own re-read (a dangling bookmark is a no-op on the /learning grid). The slug
// is immutable once created so the /library/[slug] URL contract stays stable.

export const PATCH = withAdminAuth(
  async (
    request: NextRequest,
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const body = await parseBody(request, resourceUpdateSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const { data, error } = await service
      .from("resources")
      .update(body)
      .eq("id", id)
      .select(
        "id, slug, title, content_type, url, summary, meta, author, status, created_at"
      )
      .single();
    if (error) return dbError(error, "resource-update");

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
    const { error } = await service.from("resources").delete().eq("id", id);
    if (error) return dbError(error, "resource-delete");

    return NextResponse.json({ deleted: true });
  }
);
