import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { getVisibleUpdate, countLikes } from "@/lib/updates/social";

// Like / unlike a community feed update. POST likes, DELETE unlikes — a per-
// member toggle (UNIQUE(update_id, participant_id), migration 00073). Service-
// role writes with the participant bound from the session; the like is gated to
// an update the member can actually see (labs-wide or their own private post).
// Both return the fresh { liked, count } so the client can reconcile.
async function toggle(
  like: boolean,
  auth: AuthenticatedRequest,
  params: Record<string, string>
) {
  const id = parseIntParam(params.id, "id");
  if (id instanceof NextResponse) return id;

  const viewerId = auth.user.participantId;
  if (viewerId == null) {
    return NextResponse.json({ error: "No participant profile" }, { status: 403 });
  }

  const service = createServiceClient();
  const update = await getVisibleUpdate(service, id, viewerId);
  if (!update) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (like) {
    // Idempotent: a double-tap (or a stale client) must not 409 on the UNIQUE.
    const { error } = await service
      .from("profile_update_likes")
      .upsert(
        { update_id: id, participant_id: viewerId },
        { onConflict: "update_id,participant_id", ignoreDuplicates: true }
      );
    if (error) return dbError(error, "update-like");
  } else {
    const { error } = await service
      .from("profile_update_likes")
      .delete()
      .eq("update_id", id)
      .eq("participant_id", viewerId);
    if (error) return dbError(error, "update-unlike");
  }

  const count = await countLikes(service, id);
  return NextResponse.json({ liked: like, count });
}

export const POST = withAuth((_request: NextRequest, auth, params) =>
  toggle(true, auth, params)
);

export const DELETE = withAuth((_request: NextRequest, auth, params) =>
  toggle(false, auth, params)
);
