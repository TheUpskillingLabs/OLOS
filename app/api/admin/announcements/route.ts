import { NextRequest, NextResponse } from "next/server";
import {
  withAdminAuth,
  type AuthenticatedRequest,
} from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { announcementCreateSchema } from "@/lib/validations/announcement";

// Create an org announcement (the /admin/announcements compose form). Admin-
// gated, service-role. lab_id null = global; publishing on create stamps
// published_at; the acting admin is recorded as the author. Mirrors the
// spotlight admin write pattern (app/api/admin/stories).
export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, announcementCreateSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const insert: Record<string, unknown> = {
      title: body.title,
      body: body.body,
      lab_id: body.lab_id ?? null,
      status: body.status ?? "draft",
      pinned: body.pinned ?? false,
      author_participant_id: auth.user.participantId,
    };
    if (insert.status === "published") {
      insert.published_at = new Date().toISOString();
    }

    const { data, error } = await service
      .from("announcements")
      .insert(insert)
      .select("id, status")
      .single();
    if (error) return dbError(error, "announcement-create");
    return NextResponse.json(data, { status: 201 });
  }
);
