import { NextResponse, NextRequest } from "next/server";
import {
  withAdminAuth,
  type AuthenticatedRequest,
} from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { parseIntParam } from "@/lib/api/params";
import { dbError } from "@/lib/api/errors";
import { eventEditorialUpdateSchema } from "@/lib/validations/event-admin";

/* Edit an event's editorial fields — description, body, bring. That's the
   whole surface on purpose: everything else on an event is either owned by
   the Luma sync (name, times, location, img, luma_url — overwritten every
   tick, so editing here would be writing in sand) or is program structure
   (slug, kind, anchor, status) that moves via migrations and ops scripts,
   not a content form. The schema whitelists the three fields, so nothing
   else can arrive in the update payload.

   No POST and no DELETE: events are born from the sync (or a migration),
   and they leave by archiving, never deletion (history + RSVP rows). */

export const PATCH = withAdminAuth(
  async (
    request: NextRequest,
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.id, "id");
    if (id instanceof NextResponse) return id;

    const body = await parseBody(request, eventEditorialUpdateSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const { data, error } = await service
      .from("events")
      .update(body)
      .eq("id", id)
      .select(
        "id, slug, name, kind, anchor, start_at, status, description, bring, body, synced_at"
      )
      .single();
    if (error) return dbError(error, "event-editorial-update");

    return NextResponse.json(data);
  }
);
