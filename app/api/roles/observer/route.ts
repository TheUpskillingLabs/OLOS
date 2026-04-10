import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { observerRoleSchema } from "@/lib/validations/pods";
import { ROLE_PRESETS } from "@/lib/auth/permissions";

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

    // Also grant corresponding permissions
    const serviceClient = createServiceClient();
    const permissions = ROLE_PRESETS["observer"] ?? [];
    for (const permission of permissions) {
      await serviceClient
        .from("participant_permissions")
        .upsert(
          {
            participant_id,
            permission,
            granted_by: auth.user.participantId,
            revoked_at: null,
          },
          { onConflict: "participant_id,permission" }
        );
    }

    return NextResponse.json(data, { status: 201 });
  }
);
