import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { observerRoleSchema } from "@/lib/validations/pods";

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, observerRoleSchema);
    if (isErrorResponse(body)) return body;
    const { participant_id } = body;

    const { data, error } = await auth.supabase
      .from("user_roles")
      .insert({
        participant_id,
        role: "observer",
        granted_by: auth.user.participantId,
      })
      .select("id, granted_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data, { status: 201 });
  }
);
