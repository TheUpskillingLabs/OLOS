import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { parseIntParam } from "@/lib/api/params";
import { customTaskUpdateSchema } from "@/lib/validations/custom-tasks";

// PATCH: edit an authored task; `archived: true/false` retires/restores it
// (rows are never deleted — task_dismissals reference their ids, and a
// re-announcement should be a NEW row so dismissals don't bleed across).

const COLUMNS =
  "id, title, detail, href, cta, cycle_id, starts_at, ends_at, pinned, dismissible, created_by, created_at, updated_at, archived_at";

export const PATCH = withAdminAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const id = parseIntParam(params.task_id, "task_id");
    if (id instanceof NextResponse) return id;

    const body = await parseBody(request, customTaskUpdateSchema);
    if (isErrorResponse(body)) return body;

    const { archived, ...fields } = body;
    const update: Record<string, unknown> = {
      ...fields,
      updated_at: new Date().toISOString(),
    };
    if (archived !== undefined) {
      update.archived_at = archived ? new Date().toISOString() : null;
    }

    const { data, error } = await auth.supabase
      .from("custom_tasks")
      .update(update)
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();

    if (error) return dbError(error, "custom-tasks");
    if (!data) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task: data });
  }
);
