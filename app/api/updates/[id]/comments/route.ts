import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { commentCreateSchema } from "@/lib/validations/comment";
import {
  getVisibleUpdate,
  shapeComment,
  COMMENT_SELECT,
} from "@/lib/updates/social";

// Add a comment to a community feed update (migration 00073). Service-role
// write with the author bound from the session; gated to an update the member
// can see (labs-wide or their own private post). Returns the shaped comment
// (poster allowlist only) so the client can append it in place.
export const POST = withAuth(
  async (
    request: NextRequest,
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

    const body = await parseBody(request, commentCreateSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const update = await getVisibleUpdate(service, id, viewerId);
    if (!update) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await service
      .from("profile_update_comments")
      .insert({ update_id: id, participant_id: viewerId, body: body.body })
      .select(COMMENT_SELECT)
      .single();
    if (error) return dbError(error, "comment-create");

    return NextResponse.json(shapeComment(data as never), { status: 201 });
  }
);
