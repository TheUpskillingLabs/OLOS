import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleStatusSchema } from "@/lib/validations/cycles";

// Cycle lifecycle (SECTOR_MODEL.md §4): draft → upcoming → active → closing →
// archived. 'closed' is retained as a legacy terminal for pre-sector cohorts.
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["upcoming", "active"],
  upcoming: ["active"],
  active: ["closing", "closed"],
  closing: ["archived"],
};

export const PATCH = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const body = await parseBody(request, updateCycleStatusSchema);
    if (isErrorResponse(body)) return body;
    const { status } = body;

    // Get current status
    const { data: cycle } = await auth.supabase
      .from("cycles")
      .select("status")
      .eq("id", cycleId)
      .single();

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    if (cycle.status === "closed" || cycle.status === "archived") {
      return NextResponse.json(
        { error: "A closed or archived cycle cannot be reopened." },
        { status: 400 }
      );
    }

    if (!VALID_TRANSITIONS[cycle.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${cycle.status}' to '${status}'.` },
        { status: 400 }
      );
    }

    // At most one 'active' and one 'upcoming' cycle at a time (migrations
    // 00048/00049). Reject a second one with a clear message instead of a raw
    // unique-violation.
    if (status === "active" || status === "upcoming") {
      const { count } = await auth.supabase
        .from("cycles")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
        .neq("id", cycleId);
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            error: `Another cycle is already ${status}. Only one ${status} cycle is allowed at a time.`,
          },
          { status: 409 }
        );
      }
    }

    const { data, error } = await auth.supabase
      .from("cycles")
      .update({ status })
      .eq("id", cycleId)
      .select("id, name, status, updated_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
