import { NextResponse, NextRequest } from "next/server";
import { withAuth, withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { isAdmin, can } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { togglePermissionsSchema } from "@/lib/validations/invitations";
import { createServiceClient } from "@/lib/supabase/server";

export const GET = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const url = new URL(request.url);
    const participantId = url.searchParams.get("participant_id");

    if (!participantId) {
      // Return own permissions
      return NextResponse.json({ permissions: auth.user.permissions });
    }

    const pid = parseInt(participantId);
    if (isNaN(pid)) {
      return NextResponse.json({ error: "Invalid participant_id" }, { status: 400 });
    }

    // Must be admin to view others' permissions
    if (pid !== auth.user.participantId && !isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("participant_permissions")
      .select("permission, granted_at, revoked_at")
      .eq("participant_id", pid)
      .is("revoked_at", null);

    if (error) return dbError(error);

    return NextResponse.json({
      participant_id: pid,
      permissions: (data ?? []).map((r) => r.permission),
    });
  }
);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, togglePermissionsSchema);
    if (isErrorResponse(body)) return body;

    const { participant_id, permissions, action } = body;

    // If toggling roles:write, caller must have roles:write
    if (permissions.includes("roles:write") && !can(auth.user, "roles:write")) {
      return NextResponse.json(
        { error: "Only users with roles:write can grant that permission" },
        { status: 403 }
      );
    }

    const serviceClient = createServiceClient();

    if (action === "grant") {
      const rows = permissions.map((perm) => ({
        participant_id,
        permission: perm,
        granted_by: auth.user.participantId,
      }));

      const { error } = await serviceClient
        .from("participant_permissions")
        .upsert(rows, { onConflict: "participant_id,permission", ignoreDuplicates: false })
        .select();

      // Also clear revoked_at for any that were previously revoked
      await serviceClient
        .from("participant_permissions")
        .update({ revoked_at: null, granted_by: auth.user.participantId, granted_at: new Date().toISOString() })
        .eq("participant_id", participant_id)
        .in("permission", permissions)
        .not("revoked_at", "is", null);

      if (error) return dbError(error);
    } else {
      const { error } = await serviceClient
        .from("participant_permissions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("participant_id", participant_id)
        .in("permission", permissions)
        .is("revoked_at", null);

      if (error) return dbError(error);
    }

    // Return updated permissions
    const { data: updated } = await serviceClient
      .from("participant_permissions")
      .select("permission")
      .eq("participant_id", participant_id)
      .is("revoked_at", null);

    return NextResponse.json({
      participant_id,
      permissions: (updated ?? []).map((r) => r.permission),
    });
  }
);
