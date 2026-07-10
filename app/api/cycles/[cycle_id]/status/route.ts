import { NextResponse, NextRequest } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireCycleConfig } from "@/lib/auth/cycle-access";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleStatusSchema } from "@/lib/validations/cycles";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["upcoming", "active"],
  upcoming: ["active"],
  active: ["closing", "closed"],
  closing: ["closed"],
};

// HQ (cycles:write) manages any cycle's status; a local labs lead (pods:write)
// only their OWN lab's cycle (enforced by requireCycleConfig).
export const PATCH = withPermissionAuth(
  "pods:write",
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const body = await parseBody(request, updateCycleStatusSchema);
    if (isErrorResponse(body)) return body;
    const { status } = body;

    const guard = await requireCycleConfig(auth.supabase, auth.user, cycleId);
    if (guard) return guard;

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

    // Service client: cycles_update RLS is is_admin_or_owner()-gated, which a
    // labs lead is not; authorization is already enforced by requireCycleConfig.
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("cycles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", cycleId)
      .select("id, name, status, updated_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
