import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseInt(params.cycle_id);

    const { data, error } = await auth.supabase
      .from("cycle_config")
      .select("*")
      .eq("cycle_id", cycleId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

export const PATCH = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseInt(params.cycle_id);
    const body = await request.json();

    const { data, error } = await auth.supabase
      .from("cycle_config")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("cycle_id", cycleId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }
);
