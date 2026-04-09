import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseInt(params.cycle_id);

    const { data, error } = await auth.supabase
      .from("access_revocations")
      .select("participant_id, reason, revocation_scope, revoked_at, revoked_systems")
      .eq("cycle_id", cycleId)
      .order("revoked_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }
);
