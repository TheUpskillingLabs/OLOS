import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";

/** Remove a lab lead: stamp removed_at (audit trail; re-grantable). */
export const DELETE = withAdminAuth(
  async (_request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const labId = parseIntParam(params.lab_id, "lab_id");
    if (labId instanceof NextResponse) return labId;
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("lab_leads")
      .update({ removed_at: new Date().toISOString() })
      .eq("participant_id", participantId)
      .eq("lab_id", labId)
      .is("removed_at", null)
      .select("id");
    if (error) return dbError(error);
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No active lead assignment for this participant and lab." },
        { status: 404 }
      );
    }
    return NextResponse.json({ removed: data.length });
  }
);
