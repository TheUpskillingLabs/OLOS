import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { postCreateSchema } from "@/lib/validations/post";
import { isPageAdmin } from "@/lib/pages/authz";

// Create a feed update. Two authorships:
//   • as yourself (default) — public → visibility 'labs', private → 'private'.
//   • as a page (`as: {type,id}`) — only if the session participant is an admin
//     of that page; page posts are always public ('labs'), with participant_id
//     NULL, the page identity in author_page_type/id, and posted_by set for
//     provenance.
// Written via the service client (profile_updates has no INSERT policy — 00040);
// the author is bound from the session, never the client. learning_log_id stays
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

    if (body.as) {
      // Posting AS a page — authorize the session participant against it.
      const allowed = await isPageAdmin(
        service,
        auth.user,
        body.as.type,
        body.as.id
      );
      if (!allowed) {
        return NextResponse.json(
          { error: "You can't post as that page" },
          { status: 403 }
        );
      }
      const { data, error } = await service
        .from("profile_updates")
        .insert({
          participant_id: null,
          author_page_type: body.as.type,
          author_page_id: body.as.id,
          posted_by_participant_id: auth.user.participantId,
          body: body.body,
          visibility: "labs",
        })
        .select("id, created_at")
        .single();
      if (error) return dbError(error, "page-post-create");
      return NextResponse.json(data, { status: 201 });
    }

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
