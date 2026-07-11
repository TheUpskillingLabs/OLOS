import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data, error } = await auth.supabase
      .from("cycles")
      .select("id, name, slug, start_date, end_date, status")
      .eq("id", cycleId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);
