import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { PAGE_TYPES, type PageType } from "@/lib/pages/authz";
import {
  decodeCursor,
  fetchFeedPage,
  FEED_PAGE_SIZE,
  type FeedScope,
} from "@/lib/updates/feed";

// Paginate the community feed. GET ?cursor=<created_at>_<id>&limit=30 plus an
// optional scope (&participant_id=N for a member's shares, or
// &page_type=T&page_id=N for a page's own posts; neither = the viewer's
// Following feed). Runs the same fetchFeedPage the server-rendered first page
// uses, so visibility rules (labs-wide + viewer-own private) cannot drift.
export const GET = withAuth(async (request: NextRequest, auth) => {
  const params = request.nextUrl.searchParams;

  const rawCursor = params.get("cursor");
  const cursor = rawCursor != null ? decodeCursor(rawCursor) : null;
  if (rawCursor != null && cursor == null) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const rawLimit = params.get("limit");
  let limit = FEED_PAGE_SIZE;
  if (rawLimit != null) {
    const n = Number(rawLimit);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }
    limit = n;
  }

  const scope: FeedScope = {};
  const rawParticipant = params.get("participant_id");
  const rawPageType = params.get("page_type");
  const rawPageId = params.get("page_id");
  if (rawParticipant != null) {
    const id = Number(rawParticipant);
    if (!Number.isInteger(id) || id < 0) {
      return NextResponse.json(
        { error: "Invalid participant_id" },
        { status: 400 }
      );
    }
    scope.participantId = id;
  } else if (rawPageType != null || rawPageId != null) {
    const id = Number(rawPageId);
    if (
      !PAGE_TYPES.includes(rawPageType as PageType) ||
      !Number.isInteger(id) ||
      id < 0
    ) {
      return NextResponse.json({ error: "Invalid page scope" }, { status: 400 });
    }
    scope.pageType = rawPageType as PageType;
    scope.pageId = id;
  }

  const service = createServiceClient();
  const page = await fetchFeedPage({
    service,
    scope,
    viewer: { participantId: auth.user.participantId, roles: auth.user },
    cursor,
    limit,
  });
  return NextResponse.json(page);
});
