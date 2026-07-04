import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleConfigSchema } from "@/lib/validations/cycles";

export const GET = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

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
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const body = await parseBody(request, updateCycleConfigSchema);
    if (isErrorResponse(body)) return body;

    const { data, error } = await auth.supabase
      .from("cycle_config")
      .update({ ...body })
      .eq("cycle_id", cycleId)
      .select()
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
