import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { followToggleSchema } from "@/lib/validations/follow";
import { targetColumns } from "@/lib/follows/data";

// Follow / unfollow a member ("user") or an org page (sector / workstream /
// lab). Idempotent toggle: `following` is the desired end state. Service-role
// write with the follower bound from the session; the UNIQUE(follower, target)
// indexes keep it single-row, so a double-follow is a no-op (23505 swallowed).
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const viewerId = auth.user.participantId;
    if (viewerId == null) {
      return NextResponse.json(
        { error: "No participant profile" },
        { status: 403 }
      );
    }

    const body = await parseBody(request, followToggleSchema);
    if (isErrorResponse(body)) return body;

    if (body.type === "user" && body.id === viewerId) {
      return NextResponse.json(
        { error: "You can't follow yourself" },
        { status: 400 }
      );
    }

    const service = createServiceClient();
    const cols = targetColumns({ type: body.type, id: body.id });

    if (body.following) {
      const { error } = await service
        .from("follows")
        .insert({ follower_participant_id: viewerId, ...cols });
      // 23505 = already following; the toggle is idempotent.
      if (error && error.code !== "23505") return dbError(error, "follow");
    } else {
      let del = service
        .from("follows")
        .delete()
        .eq("follower_participant_id", viewerId);
      if (body.type === "user") {
        del = del.eq("followee_participant_id", body.id);
      } else {
        del = del.eq("page_type", body.type).eq("page_id", body.id);
      }
      const { error } = await del;
      if (error) return dbError(error, "unfollow");
    }

    return NextResponse.json({ following: body.following });
  }
);
