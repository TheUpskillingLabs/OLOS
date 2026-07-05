import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleStatusSchema } from "@/lib/validations/cycles";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["closed"],
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

    if (cycle.status === "closed") {
      return NextResponse.json(
        { error: "A closed cycle cannot be reopened." },
        { status: 400 }
      );
    }

    if (!VALID_TRANSITIONS[cycle.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${cycle.status}' to '${status}'.` },
        { status: 400 }
      );
    }

    // At most one active cycle at a time (migration 00048). Reject a second
    // activation with a clear message instead of a raw unique-violation.
    if (status === "active") {
      const { count } = await auth.supabase
        .from("cycles")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .neq("id", cycleId);
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          { error: "Another cycle is already active. Close it before activating this one." },
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
