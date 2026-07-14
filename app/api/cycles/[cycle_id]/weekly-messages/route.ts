import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { weeklyMessagesSchema } from "@/lib/validations/cycles";
import { rejectOrgCycle } from "@/lib/cycle/guards";

// Per-week "What's next" copy for a cycle (cycle_weekly_messages). Admins set
// one message per week (0–12); the Learning Log POST reads the current week's
// message back to the member after a save. Org cycles don't run the wk0→wk12
// participant calendar, so this is a participant-cycle-only surface (guarded
// via rejectOrgCycle). Auth/parse/error shapes mirror the sibling config route.

export const GET = withAdminAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data, error } = await auth.supabase
      .from("cycle_weekly_messages")
      .select("cycle_id, week, message, updated_at")
      .eq("cycle_id", cycleId)
      .order("week", { ascending: true });

    if (error) return dbError(error, "weekly-messages");

    return NextResponse.json({ messages: data ?? [] });
  }
);

export const PUT = withAdminAuth(
  async (
    request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const orgReject = await rejectOrgCycle(
      auth.supabase,
      cycleId,
      "Weekly messages apply to participant cycles only."
    );
    if (orgReject) return orgReject;

    const body = await parseBody(request, weeklyMessagesSchema);
    if (isErrorResponse(body)) return body;

    const now = new Date().toISOString();
    const toUpsert: {
      cycle_id: number;
      week: number;
      message: string;
      updated_at: string;
    }[] = [];
    const toDelete: number[] = [];
    for (const entry of body.messages) {
      const trimmed = entry.message.trim();
      if (trimmed) {
        toUpsert.push({
          cycle_id: cycleId,
          week: entry.week,
          message: trimmed,
          updated_at: now,
        });
      } else {
        // A blank message clears that week's row rather than storing empty copy.
        toDelete.push(entry.week);
      }
    }

    if (toUpsert.length > 0) {
      const { error } = await auth.supabase
        .from("cycle_weekly_messages")
        .upsert(toUpsert, { onConflict: "cycle_id,week" });
      if (error) return dbError(error, "weekly-messages");
    }

    if (toDelete.length > 0) {
      const { error } = await auth.supabase
        .from("cycle_weekly_messages")
        .delete()
        .eq("cycle_id", cycleId)
        .in("week", toDelete);
      if (error) return dbError(error, "weekly-messages");
    }

    const { data, error } = await auth.supabase
      .from("cycle_weekly_messages")
      .select("cycle_id, week, message, updated_at")
      .eq("cycle_id", cycleId)
      .order("week", { ascending: true });

    if (error) return dbError(error, "weekly-messages");

    return NextResponse.json({ messages: data ?? [] });
  }
);
