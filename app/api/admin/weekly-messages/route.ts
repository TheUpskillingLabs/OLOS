import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { weeklyMessagesSchema } from "@/lib/validations/cycles";

// Program-global per-week "What's next" copy (weekly_messages, 00088). Admins
// set one message per wk0→wk12 marker, shared by every open cycle; the
// Learning Log POST reads the current week's message back to the member after
// a save. Auth/parse/error shapes mirror the cycle config route.

export const GET = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const { data, error } = await auth.supabase
      .from("weekly_messages")
      .select("week, message, updated_at")
      .order("week", { ascending: true });

    if (error) return dbError(error, "weekly-messages");

    return NextResponse.json({ messages: data ?? [] });
  }
);

export const PUT = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, weeklyMessagesSchema);
    if (isErrorResponse(body)) return body;

    const now = new Date().toISOString();
    const toUpsert: { week: number; message: string; updated_at: string }[] =
      [];
    const toDelete: number[] = [];
    for (const entry of body.messages) {
      const trimmed = entry.message.trim();
      if (trimmed) {
        toUpsert.push({ week: entry.week, message: trimmed, updated_at: now });
      } else {
        // A blank message clears that week's row rather than storing empty copy.
        toDelete.push(entry.week);
      }
    }

    if (toUpsert.length > 0) {
      const { error } = await auth.supabase
        .from("weekly_messages")
        .upsert(toUpsert, { onConflict: "week" });
      if (error) return dbError(error, "weekly-messages");
    }

    if (toDelete.length > 0) {
      const { error } = await auth.supabase
        .from("weekly_messages")
        .delete()
        .in("week", toDelete);
      if (error) return dbError(error, "weekly-messages");
    }

    const { data, error } = await auth.supabase
      .from("weekly_messages")
      .select("week, message, updated_at")
      .order("week", { ascending: true });

    if (error) return dbError(error, "weekly-messages");

    return NextResponse.json({ messages: data ?? [] });
  }
);
