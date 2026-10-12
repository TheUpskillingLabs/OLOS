import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { requireLabAccess } from "@/lib/auth/lab";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { announcementPatchSchema } from "@/lib/validations/announcement";
import { scheduleError } from "@/lib/announcements/schedule";

// Edit / publish / archive an announcement (PATCH) or drop it (DELETE).
// Service-role writes, authorized by requireLabAccess against the row's CURRENT
// lab (admin → any; lab lead → only their labs; org-wide → admin-only). PATCH
// re-checks the NEW lab_id too, so a lab lead can't move a row to another lab
// or org-wide. Publishing stamps published_at once (kept once set) unless the
// body sends a go-live time — a future one (re)schedules the post. Any change
// that touches the schedule, or publishes, re-validates the go-live/expiry
// window against the row's resulting values.
export const PATCH = withAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const body = await parseBody(request, announcementPatchSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const { data: current } = await service
      .from("announcements")
      .select("id, lab_id, status, published_at, expires_at")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Must have access to the row's current lab...
    const guard = requireLabAccess(auth.user, current.lab_id);
    if (guard) return guard;
    // ...and, if the audience is being changed, to the new lab as well.
    if (body.lab_id !== undefined) {
      const guardNew = requireLabAccess(auth.user, body.lab_id ?? null);
      if (guardNew) return guardNew;
    }

    const now = new Date();
    const update: Record<string, unknown> = { ...body };
    const status = body.status ?? current.status;
    if (status === "published" && body.published_at === null) {
      // Clearing the go-live on a published row means "now", never "unset".
      update.published_at = now.toISOString();
    } else if (
      body.status === "published" &&
      body.published_at === undefined &&
      !current.published_at
    ) {
      update.published_at = now.toISOString();
    }

    const touchesSchedule =
      body.status === "published" ||
      body.published_at !== undefined ||
      body.expires_at !== undefined;
    if (touchesSchedule) {
      const invalid = scheduleError({
        publishing: status === "published",
        goLive:
          update.published_at !== undefined
            ? (update.published_at as string | null)
            : current.published_at,
        expiresAt:
          body.expires_at !== undefined ? body.expires_at : current.expires_at,
        now,
      });
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    }

    const { data, error } = await service
      .from("announcements")
      .update(update)
      .eq("id", id)
      .select("id, status, published_at, expires_at")
      .single();
    if (error) return dbError(error, "announcement-update");
    return NextResponse.json(data);
  }
);

export const DELETE = withAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const service = createServiceClient();
    const { data: current } = await service
      .from("announcements")
      .select("id, lab_id")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const guard = requireLabAccess(auth.user, current.lab_id);
    if (guard) return guard;

    const { error } = await service.from("announcements").delete().eq("id", id);
    if (error) return dbError(error, "announcement-delete");
    return NextResponse.json({ deleted: true });
  }
);
