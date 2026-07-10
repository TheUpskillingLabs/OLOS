import { NextResponse, NextRequest } from "next/server";
import { withPermissionAuth, withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import { requireCycleManagement } from "@/lib/auth/cycle-access";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { moderatorAssignmentSchema } from "@/lib/validations/pods";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    if (!isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await auth.supabase
      .from("moderator_assignments")
      .select(`
        participant_id, assigned_at, removed_at,
        participants (first_name, last_name)
      `)
      .eq("pod_id", podId)
      .order("assigned_at");

    if (error) {
      return dbError(error);
    }

    const result = (data || []).map((a) => {
      const p = (a.participants as unknown) as Record<string, unknown>;
      return {
        participant_id: a.participant_id,
        name: `${p?.first_name || ""} ${p?.last_name || ""}`.trim(),
        assigned_at: a.assigned_at,
        removed_at: a.removed_at,
      };
    });

    return NextResponse.json(result);
  }
);

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
      .insert({ participant_id, pod_id: podId, cycle_id })
      .select("id, participant_id, pod_id, assigned_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(
      { moderator_assignment_id: data.id, ...data },
      { status: 201 }
    );
  }
);
