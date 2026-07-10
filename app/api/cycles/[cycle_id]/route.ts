import { NextResponse, NextRequest } from "next/server";
import { withAuth, withPermissionAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireCycleConfig, isFullCycleAdmin } from "@/lib/auth/cycle-access";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleDetailsSchema } from "@/lib/validations/cycles";
import { dbError } from "@/lib/api/errors";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data, error } = await auth.supabase
      .from("cycles")
      .select("id, name, slug, start_date, end_date, status, description, what_you_build")
      .eq("id", cycleId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

// Edit cycle "About" / information-page content + lab/kind assignment.
// HQ (cycles:write) may edit any cycle; a local labs lead (pods:write) may edit
// only their OWN lab's cycle (enforced by requireCycleConfig). Labs leads can't
// change metro_slug / is_hq_internal — that would let them move a cycle to
// another lab or hide it — so those fields are stripped for non-full-admins.
export const PATCH = withPermissionAuth(
  "pods:write",
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const body = await parseBody(request, updateCycleDetailsSchema);
    if (isErrorResponse(body)) return body;

    const guard = await requireCycleConfig(auth.supabase, auth.user, cycleId);
    if (guard) return guard;

    const patch: Record<string, unknown> = { ...body };
    if (!isFullCycleAdmin(auth.user)) {
      delete patch.metro_slug;
      delete patch.is_hq_internal;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Service client: cycles_update RLS is is_admin_or_owner()-gated, which a
    // labs lead is not; authorization is already enforced by requireCycleConfig.
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("cycles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", cycleId)
      .select("id, name, status, description, what_you_build")
      .single();

    if (error) {
      return dbError(error, "cycle-details");
    }

    return NextResponse.json(data);
  }
);
