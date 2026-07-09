import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { postCreateSchema } from "@/lib/validations/post";

// Create a freeform member post (the feed composer). Public → visibility 'labs'
// (the members-wide community feed); private → 'private' (author-only). Written
// via the service client (profile_updates has no INSERT policy — 00040), with
// the participant bound from the session, not the client. learning_log_id stays
// NULL: a post is a direct write, not a shared Learning Log.
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, postCreateSchema);
    if (isErrorResponse(body)) return body;

    if (auth.user.participantId == null) {
      return NextResponse.json(
        { error: "No participant profile" },
        { status: 403 }
      );
    }

    const service = createServiceClient();
    const { data, error } = await service
      .from("profile_updates")
      .insert({
        participant_id: auth.user.participantId,
        body: body.body,
        visibility: body.visibility === "private" ? "private" : "labs",
      })
      .select("id, visibility, created_at")
      .single();
    if (error) return dbError(error, "post-create");
    return NextResponse.json(data, { status: 201 });
  }
);
