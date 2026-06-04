import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createFeedbackSchema } from "@/lib/validations/feedback";

const BUCKET = "feedback-attachments";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, createFeedbackSchema);
    if (isErrorResponse(body)) return body;

    const { category, description, page_url, attachments } = body;

    // Insert the feedback row as the current user (RLS: auth_user_id = auth.uid()).
    const { data: feedback, error: insertError } = await auth.supabase
      .from("feedback")
      .insert({
        auth_user_id: auth.user.userId,
        participant_id: auth.user.participantId,
        category,
        description,
        page_url: page_url ?? null,
      })
      .select("id, created_at")
      .single();

    if (insertError) {
      return dbError(insertError, "feedback insert");
    }

    // Upload attachments via the service client (bypasses storage RLS), then
    // record their paths. Storage/attachment failures don't discard the
    // already-saved feedback text — we just report how many made it.
    let uploaded = 0;
    if (attachments && attachments.length > 0) {
      const service = createServiceClient();
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i];
        const ext = EXT[att.type] ?? "bin";
        const path = `${feedback.id}/${i}.${ext}`;
        const bytes = Buffer.from(att.data, "base64");

        const { error: uploadError } = await service.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType: att.type, upsert: true });

        if (uploadError) {
          console.error("[feedback] attachment upload failed", uploadError.message);
          continue;
        }

        const { error: attachError } = await service
          .from("feedback_attachments")
          .insert({
            feedback_id: feedback.id,
            storage_path: path,
            mime_type: att.type,
            size_bytes: bytes.length,
          });

        if (attachError) {
          console.error("[feedback] attachment row failed", attachError.message);
          continue;
        }
        uploaded++;
      }
    }

    return NextResponse.json(
      { id: feedback.id, created_at: feedback.created_at, attachments_saved: uploaded },
      { status: 201 }
    );
  }
);
