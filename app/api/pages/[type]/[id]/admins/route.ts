import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { pageAdminAddSchema } from "@/lib/validations/page-admin";
import { isPageAdmin, PAGE_TYPES, type PageType } from "@/lib/pages/authz";

// Add an explicit admin to a page (the "others can be added" list). Only an
// existing admin of the page may add another; the new admin can then post as the
// page and manage its admins. Idempotent — re-adding an active admin is a no-op.
export const POST = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const type = params.type as PageType;
    if (!PAGE_TYPES.includes(type)) {
      return NextResponse.json({ error: "Unknown page type" }, { status: 400 });
    }
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const viewerId = auth.user.participantId;
    if (viewerId == null) {
      return NextResponse.json(
        { error: "No participant profile" },
        { status: 403 }
      );
    }

    const service = createServiceClient();
    if (!(await isPageAdmin(service, auth.user, type, id))) {
      return NextResponse.json({ error: "Not a page admin" }, { status: 403 });
    }

    const body = await parseBody(request, pageAdminAddSchema);
    if (isErrorResponse(body)) return body;

    const { data: target } = await service
      .from("participants")
      .select("id, handle, preferred_name, first_name, last_name")
      .eq("handle", body.handle)
      .maybeSingle();
    if (!target) {
      return NextResponse.json(
        { error: `No member with the handle @${body.handle}` },
        { status: 404 }
      );
    }

    const { data: active } = await service
      .from("page_admins")
      .select("id")
      .eq("page_type", type)
      .eq("page_id", id)
      .eq("participant_id", target.id)
      .is("removed_at", null)
      .maybeSingle();

    if (!active) {
      const { error } = await service.from("page_admins").insert({
        page_type: type,
        page_id: id,
        participant_id: target.id,
        added_by_participant_id: viewerId,
      });
      if (error) return dbError(error, "page-admin-add");
    }

    const name =
      target.preferred_name ||
      [target.first_name, target.last_name].filter(Boolean).join(" ") ||
      "A member";
    return NextResponse.json(
      {
        participantId: target.id,
        name,
        handle: target.handle,
        source: "added",
      },
      { status: 201 }
    );
  }
);
