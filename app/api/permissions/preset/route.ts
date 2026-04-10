import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { can } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { applyPresetSchema } from "@/lib/validations/invitations";
import { ROLE_PRESETS } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, applyPresetSchema);
    if (isErrorResponse(body)) return body;

    const { participant_id, preset } = body;
    const permissions = ROLE_PRESETS[preset];

    if (!permissions) {
      return NextResponse.json({ error: "Unknown preset" }, { status: 400 });
    }

    // If preset includes roles:write, caller must have roles:write
    if (permissions.includes("roles:write") && !can(auth.user, "roles:write")) {
      return NextResponse.json(
        { error: "Only users with roles:write can apply this preset" },
        { status: 403 }
      );
    }

    const serviceClient = createServiceClient();

    // Insert all permissions for the preset
    const rows = permissions.map((perm) => ({
      participant_id,
      permission: perm,
      granted_by: auth.user.participantId,
    }));

    const { error } = await serviceClient
      .from("participant_permissions")
      .upsert(rows, { onConflict: "participant_id,permission", ignoreDuplicates: false });

    if (error) return dbError(error);

    // Clear revoked_at for any previously revoked
    await serviceClient
      .from("participant_permissions")
      .update({ revoked_at: null, granted_by: auth.user.participantId, granted_at: new Date().toISOString() })
      .eq("participant_id", participant_id)
      .in("permission", permissions)
      .not("revoked_at", "is", null);

    // Also record in user_roles for audit trail (if applicable preset)
    if (["owner", "admin", "developer", "observer"].includes(preset)) {
      await serviceClient
        .from("user_roles")
        .upsert(
          { participant_id, role: preset, granted_by: auth.user.participantId },
          { onConflict: "participant_id,role", ignoreDuplicates: true }
        );
    }

    // Return updated permissions
    const { data: updated } = await serviceClient
      .from("participant_permissions")
      .select("permission")
      .eq("participant_id", participant_id)
      .is("revoked_at", null);

    return NextResponse.json({
      participant_id,
      preset,
      permissions: (updated ?? []).map((r) => r.permission),
    });
  }
);
