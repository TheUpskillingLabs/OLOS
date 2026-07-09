import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";

// Retract your own comment on a feed update (migration 00073). Service-role
// delete scoped to the author (participant_id from the session), so a member
// can only remove their own comment — a 404 otherwise (missing, or someone
// else's). The [id] update segment is validated but the delete keys on the
// comment id.
export const DELETE = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const updateId = parseIntParam(params.id, "id");
    if (updateId instanceof NextResponse) return updateId;
    const commentId = parseIntParam(params.commentId, "commentId");
    if (commentId instanceof NextResponse) return commentId;

    const viewerId = auth.user.participantId;
    if (viewerId == null) {
      return NextResponse.json(
        { error: "No participant profile" },
        { status: 403 }
      );
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("profile_update_comments")
      .delete()
      .eq("id", commentId)
      .eq("update_id", updateId)
      .eq("participant_id", viewerId)
      .select("id")
      .maybeSingle();
    if (error) return dbError(error, "comment-delete");
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  }
);
