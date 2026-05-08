import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";

export const PATCH = withAdminAuth(
  async (_request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const invitationId = parseIntParam(params.invitation_id, "invitation_id");
    if (invitationId instanceof NextResponse) return invitationId;

    const serviceClient = createServiceClient();

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
