import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { requireLabAccess } from "@/lib/auth/lab";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { announcementCreateSchema } from "@/lib/validations/announcement";
import { defaultExpiry, scheduleError } from "@/lib/announcements/schedule";

// Create an announcement (the /admin/announcements compose form, or the lab
// workspace composer). Authored by an admin/owner (any audience, incl. the
// org-wide lab_id=null) OR by a lab lead scoped to a lab they lead —
// requireLabAccess enforces both: admin short-circuits; a lab lead is confined
// to their labLeadLabIds; lab_id=null resolves admin-only. Service-role write;
// the actor is recorded as the author. Publishing stamps published_at = now
// unless a go-live time was sent (a future one schedules the post).
// expires_at defaults to two weeks from creation; null means never expires.
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, announcementCreateSchema);
    if (isErrorResponse(body)) return body;

    const guard = requireLabAccess(auth.user, body.lab_id ?? null);
    if (guard) return guard;

    const status = body.status ?? "draft";
    const now = new Date();
    const expiresAt =
      body.expires_at === undefined
        ? defaultExpiry(now).toISOString()
        : body.expires_at;
    const invalid = scheduleError({
      publishing: status === "published",
      goLive: body.published_at ?? null,
      expiresAt,
      now,
    });
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const service = createServiceClient();
    const insert: Record<string, unknown> = {
      title: body.title,
      body: body.body,
      lab_id: body.lab_id ?? null,
      status,
      pinned: body.pinned ?? false,
      author_participant_id: auth.user.participantId,
      expires_at: expiresAt,
      // A draft may carry a planned go-live; publishing without one goes now.
      published_at:
        body.published_at ?? (status === "published" ? now.toISOString() : null),
    };

    const { data, error } = await service
      .from("announcements")
      .insert(insert)
      .select("id, status, published_at, expires_at")
      .single();
    if (error) return dbError(error, "announcement-create");
    return NextResponse.json(data, { status: 201 });
  }
);
