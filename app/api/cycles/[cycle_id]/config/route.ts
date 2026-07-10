import { NextResponse, NextRequest } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireCycleConfig } from "@/lib/auth/cycle-access";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleConfigSchema } from "@/lib/validations/cycles";

export const GET = withPermissionAuth(
  "pods:write",
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const guard = await requireCycleConfig(auth.supabase, auth.user, cycleId);
    if (guard) return guard;

    const { data, error } = await auth.supabase
      .from("cycle_config")
      .select("*")
      .eq("cycle_id", cycleId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

// HQ (cycles:write) configures any cycle; a local labs lead (pods:write) only
// their OWN lab's cycle (enforced by requireCycleConfig).
export const PATCH = withPermissionAuth(
  "pods:write",
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const body = await parseBody(request, updateCycleConfigSchema);
    if (isErrorResponse(body)) return body;

    const guard = await requireCycleConfig(auth.supabase, auth.user, cycleId);
    if (guard) return guard;

    // Service client: cycle_config is is_admin_or_owner()-gated by RLS, which a
    // labs lead is not; authorization is already enforced by requireCycleConfig.
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("cycle_config")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("cycle_id", cycleId)
      .select()
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
