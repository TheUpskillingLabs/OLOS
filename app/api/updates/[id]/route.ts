import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { isPageAdmin, type PageType } from "@/lib/pages/authz";

// Delete a feed update. Allowed for the post's author (your own post, public or
// private) or — for a page-authored post — any admin of that page. Service-role
// delete; likes and comments cascade (00073). 404 for anything else (missing,
// or not yours), so existence isn't leaked.
export const DELETE = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
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
    const { data: update } = await service
      .from("profile_updates")
      .select("id, participant_id, author_page_type, author_page_id")
      .eq("id", id)
      .maybeSingle();
    if (!update) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const ownPost = update.participant_id === viewerId;
    const pagePost =
      update.author_page_type != null && update.author_page_id != null;
    const canDelete =
      ownPost ||
      (pagePost &&
        (await isPageAdmin(
          service,
          auth.user,
          update.author_page_type as PageType,
          update.author_page_id
        )));
    if (!canDelete) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await service
      .from("profile_updates")
      .delete()
      .eq("id", id);
    if (error) return dbError(error, "update-delete");
    return NextResponse.json({ deleted: true });
  }
);
