import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";

export const PATCH = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const invitationId = parseIntParam(params.invitation_id, "invitation_id");
    if (invitationId instanceof NextResponse) return invitationId;

    const serviceClient = createServiceClient();

    // Local Labs (docs/LOCAL_LABS.md): admins revoke anything; a lab lead
    // may revoke only invitations they created (the POST route already
    // constrains what they can create).
    if (!isAdmin(auth.user)) {
      const { data: invitation } = await serviceClient
        .from("invitations")
        .select("invited_by")
        .eq("id", invitationId)
        .maybeSingle();
      if (!invitation || invitation.invited_by !== auth.user.participantId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data, error } = await serviceClient
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
      .in("status", ["pending", "accepted"])
      .select("id, status")
      .single();

    if (error) return dbError(error);
    if (!data) {
      return NextResponse.json({ error: "Invitation not found or already processed" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);
