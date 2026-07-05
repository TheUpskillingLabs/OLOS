import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";

/**
 * POST/DELETE /api/participants/[participant_id]/avatar
 *
 * Member profile photo. The upload is server-mediated: the client resizes the
 * image to ~512px first, then posts it here as multipart; we validate type +
 * size and write to the public `avatars` Storage bucket (migration 00046) with
 * the service role, then point participants.profile_image_url at the public URL
 * (cache-busted with ?v=). Authz is application-layer (own row or admin).
 */

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB backstop; the client sends far less
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ALL_PATHS = (id: number) =>
  Object.values(EXT).map((e) => `${id}/avatar.${e}`);

export const POST = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const targetId = parseIntParam(params.participant_id, "participant_id");
    if (targetId instanceof NextResponse) return targetId;

    if (auth.user.participantId !== targetId && !isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }
    if (!EXT[file.type]) {
      return NextResponse.json(
        { error: "Use a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image is too large (2 MB max)." },
        { status: 400 }
      );
    }

    const ext = EXT[file.type];
    const path = `${targetId}/avatar.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const service = createServiceClient();

    const { error: upErr } = await service.storage
      .from("avatars")
      .upload(path, bytes, { contentType: file.type, upsert: true });
    if (upErr) {
      console.error("[avatar] upload failed:", upErr.message);
      return NextResponse.json(
        { error: "Upload failed. Try again." },
        { status: 500 }
      );
    }

    // Drop other-extension leftovers so a png→jpg switch can't orphan a file.
    const stale = ALL_PATHS(targetId).filter((p) => p !== path);
    await service.storage.from("avatars").remove(stale);

    const { data: pub } = service.storage.from("avatars").getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: dbErr } = await service
      .from("participants")
      .update({ profile_image_url: url })
      .eq("id", targetId);
    if (dbErr) return dbError(dbErr, "avatar-set");

    return NextResponse.json({ profile_image_url: url });
  }
);

export const DELETE = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const targetId = parseIntParam(params.participant_id, "participant_id");
    if (targetId instanceof NextResponse) return targetId;

    if (auth.user.participantId !== targetId && !isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const service = createServiceClient();
    await service.storage.from("avatars").remove(ALL_PATHS(targetId));

    const { error: dbErr } = await service
      .from("participants")
      .update({ profile_image_url: null })
      .eq("id", targetId);
    if (dbErr) return dbError(dbErr, "avatar-clear");

    return NextResponse.json({ profile_image_url: null });
  }
);
