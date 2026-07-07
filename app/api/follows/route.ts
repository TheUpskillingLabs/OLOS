import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { followToggleSchema, type EntityType } from "@/lib/validations/showcase";
import { getFollowerCount } from "@/lib/follows/queries";

/**
 * Toggle a follow. POST { target_type, target_id } — follow if not yet
 * following, unfollow if already. Follower identity comes from the session
 * (auth.user.participantId), never the client. Mirrors POST /api/saved.
 */

const TARGET_TABLE: Record<EntityType, string> = {
  participant: "participants",
  pod: "pods",
  project: "projects",
  cycle: "cycles",
};

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json(
        { error: "No participant record" },
        { status: 403 }
      );
    }

    const body = await parseBody(request, followToggleSchema);
    if (isErrorResponse(body)) return body;
    const { target_type, target_id } = body;

    // Can't follow your own profile (also enforced by a DB CHECK).
    if (target_type === "participant" && target_id === participantId) {
      return NextResponse.json(
        { error: "You can't follow yourself." },
        { status: 400 }
      );
    }

    const service = createServiceClient();

    // The target must exist. A participant target must also be a real, visible
    // member — never a test/staff account (matches /directory + /u/[handle]).
    if (target_type === "participant") {
      const { data: target } = await service
        .from("participants")
        .select("id, is_test, is_staff")
        .eq("id", target_id)
        .maybeSingle();
      if (!target || target.is_test || target.is_staff) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      const { data: target } = await service
        .from(TARGET_TABLE[target_type])
        .select("id")
        .eq("id", target_id)
        .maybeSingle();
      if (!target) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    // Toggle.
    const { data: existing } = await service
      .from("follows")
      .select("id")
      .eq("follower_participant_id", participantId)
      .eq("target_type", target_type)
      .eq("target_id", target_id)
      .maybeSingle();

    let following: boolean;
    if (existing) {
      const { error } = await service
        .from("follows")
        .delete()
        .eq("id", (existing as { id: number }).id);
      if (error) {
        return NextResponse.json({ error: "Unfollow failed" }, { status: 500 });
      }
      following = false;
    } else {
      const { error } = await service.from("follows").insert({
        follower_participant_id: participantId,
        target_type,
        target_id,
      });
      // A double-click race can trip the UNIQUE constraint — treat "already
      // following" (23505) as success rather than a 500.
      if (error && error.code !== "23505") {
        return NextResponse.json({ error: "Follow failed" }, { status: 500 });
      }
      following = true;
    }

    const followerCount = await getFollowerCount(service, target_type, target_id);
    return NextResponse.json({ following, followerCount });
  }
);
