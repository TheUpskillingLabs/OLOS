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
      .select("status, mode")
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

    // At most one 'active' and one 'upcoming' cycle per mode (migrations
    // 00048/00049/00060 — org cycles run alongside a participant cycle, not
    // instead of it). Reject a second one within the same mode with a clear
    // message instead of a raw unique-violation. 'closed' mode cycles are
    // legacy pre-sector cohorts with no per-mode invariant yet — B2B
    // concurrency is deferred, so the guard is skipped entirely for them.
    if ((status === "active" || status === "upcoming") && cycle.mode !== "closed") {
      const { count } = await auth.supabase
        .from("cycles")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
        .eq("mode", cycle.mode)
        .neq("id", cycleId);
      if ((count ?? 0) > 0) {
        const modeLabel = cycle.mode === "org" ? "organization" : "open";
        return NextResponse.json(
          {
            error: `Another ${modeLabel} cycle is already ${status}. Only one ${status} cycle is allowed per mode at a time.`,
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
