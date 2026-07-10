import { NextResponse, NextRequest } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import { requireCycleManagement } from "@/lib/auth/cycle-access";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { moderatorAssignmentSchema } from "@/lib/validations/pods";

export const POST = withPermissionAuth(
  "pods:write",
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const body = await parseBody(request, moderatorAssignmentSchema);
    if (isErrorResponse(body)) return body;
    const { participant_id, cycle_id } = body;

    const guard = await requireCycleManagement(auth.supabase, auth.user, cycle_id);
    if (guard) return guard;

    const { data, error } = await auth.supabase
      .from("moderator_assignments")
      .update({ removed_at: new Date().toISOString() })
      .eq("pod_id", podId)
      .eq("participant_id", participant_id)
      .eq("cycle_id", cycle_id)
      .is("removed_at", null)
      .select("id, removed_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
