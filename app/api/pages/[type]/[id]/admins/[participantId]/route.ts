import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { isPageAdmin, PAGE_TYPES, type PageType } from "@/lib/pages/authz";

// Remove an explicitly-added page admin. Only an existing admin may remove one,
// and only EXPLICIT rows (page_admins) are removable — auto-admins (a page's
// leads / a project's members) come from their roles, not this list.
export const DELETE = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const type = params.type as PageType;
    if (!PAGE_TYPES.includes(type)) {
      return NextResponse.json({ error: "Unknown page type" }, { status: 400 });
    }
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;
    const targetId = parseIntParam(params.participantId, "participantId");
    if (targetId instanceof NextResponse) return targetId;

    if (auth.user.participantId == null) {
      return NextResponse.json(
        { error: "No participant profile" },
        { status: 403 }
      );
    }

    const service = createServiceClient();
    if (!(await isPageAdmin(service, auth.user, type, id))) {
      return NextResponse.json({ error: "Not a page admin" }, { status: 403 });
    }

    const { data, error } = await service
      .from("page_admins")
      .update({ removed_at: new Date().toISOString() })
      .eq("page_type", type)
      .eq("page_id", id)
      .eq("participant_id", targetId)
      .is("removed_at", null)
      .select("id")
      .maybeSingle();
    if (error) return dbError(error, "page-admin-remove");
    if (!data) {
      return NextResponse.json(
        { error: "Not an added admin" },
        { status: 404 }
      );
    }
    return NextResponse.json({ removed: true });
  }
);
