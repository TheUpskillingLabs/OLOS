import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { moderatorAssignmentSchema } from "@/lib/validations/pods";
import { revokeRole } from "@/lib/auth/grants";
import { createServiceClient } from "@/lib/supabase/server";

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const body = await parseBody(request, moderatorAssignmentSchema);
    if (isErrorResponse(body)) return body;
    const { participant_id, cycle_id } = body;

    // Revoke the poderator role through the single write path FIRST, so the
    // participant_roles row records revoked_by before the moderator_assignments
    // update's sync trigger revokes it (which would leave revoked_by null).
    await revokeRole(createServiceClient(), {
      participantId: participant_id,
      role: "poderator",
      scope: { podId, cycleId: cycle_id },
      actor: auth.user,
    });

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
