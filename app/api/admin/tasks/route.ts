import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { customTaskCreateSchema } from "@/lib/validations/custom-tasks";

// Admin-authored member tasks (custom_tasks, 00097). Rows created here are
// merged into every member's Up-next queue by lib/tasks (kind 'custom');
// the assembler and the dismissal store handle the rest. Auth/parse/error
// shapes mirror the weekly-messages route; writes go through the user
// client so custom_tasks RLS (admin/owner) is the enforcement.

const COLUMNS =
  "id, title, detail, href, cta, cycle_id, starts_at, ends_at, pinned, dismissible, created_by, created_at, updated_at, archived_at";

export const GET = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const { data, error } = await auth.supabase
      .from("custom_tasks")
      .select(COLUMNS)
      .order("created_at", { ascending: false });

    if (error) return dbError(error, "custom-tasks");
    return NextResponse.json({ tasks: data ?? [] });
  }
);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, customTaskCreateSchema);
    if (isErrorResponse(body)) return body;

    const { data, error } = await auth.supabase
      .from("custom_tasks")
      .insert({
        title: body.title,
        detail: body.detail ?? null,
        href: body.href,
        cta: body.cta ?? null,
        cycle_id: body.cycle_id ?? null,
        starts_at: body.starts_at ?? null,
        ends_at: body.ends_at ?? null,
        pinned: body.pinned ?? false,
        dismissible: body.dismissible ?? true,
        created_by: auth.user.participantId,
      })
      .select(COLUMNS)
      .single();

    if (error) return dbError(error, "custom-tasks");
    return NextResponse.json({ task: data }, { status: 201 });
  }
);
