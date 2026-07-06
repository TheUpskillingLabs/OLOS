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

    // Upsert on the service client: the user_roles insert RLS requires
    // roles:write (which a cycles:write-only admin lacks), and plain .insert()
    // throws a unique-violation when re-granting a soft-revoked role. Upsert
    // (resetting revoked_at) handles both; app-level withAdminAuth already
    // authorizes this (audit fix).
    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("user_roles")
      .upsert(
        {
          participant_id,
          role: "observer",
          granted_by: auth.user.participantId,
          revoked_at: null,
        },
        { onConflict: "participant_id,role" }
      )
      .select("id, granted_at")
      .single();

    if (error) {
      return dbError(error);
    }

    // Also grant corresponding permissions
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
