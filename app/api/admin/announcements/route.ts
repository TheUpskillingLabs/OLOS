import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { requireLabAccess } from "@/lib/auth/lab";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { announcementCreateSchema } from "@/lib/validations/announcement";

// Create an announcement (the /admin/announcements compose form, or the lab
// workspace composer). Authored by an admin/owner (any audience, incl. the
// org-wide lab_id=null) OR by a lab lead scoped to a lab they lead —
// requireLabAccess enforces both: admin short-circuits; a lab lead is confined
// to their labLeadLabIds; lab_id=null resolves admin-only. Service-role write;
// publishing stamps published_at; the actor is recorded as the author.
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, announcementCreateSchema);
    if (isErrorResponse(body)) return body;

    const guard = requireLabAccess(auth.user, body.lab_id ?? null);
    if (guard) return guard;

    const service = createServiceClient();
    const insert: Record<string, unknown> = {
      title: body.title,
      body: body.body,
      lab_id: body.lab_id ?? null,
      status: body.status ?? "draft",
      pinned: body.pinned ?? false,
      author_participant_id: auth.user.participantId,
    };
    if (insert.status === "published") {
      insert.published_at = new Date().toISOString();
    }

    const { data, error } = await service
      .from("announcements")
      .insert(insert)
      .select("id, status")
      .single();
    if (error) return dbError(error, "announcement-create");
    return NextResponse.json(data, { status: 201 });
  }
);
