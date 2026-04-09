import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";

export const GET = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data, error } = await auth.supabase
      .from("access_revocations")
      .select("participant_id, reason, revocation_scope, revoked_at, revoked_systems")
      .eq("cycle_id", cycleId)
      .order("revoked_at", { ascending: false });

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
