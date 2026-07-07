import { NextResponse, NextRequest } from "next/server";
import { withAuth, withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleDetailsSchema } from "@/lib/validations/cycles";
import { dbError } from "@/lib/api/errors";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data, error } = await auth.supabase
      .from("cycles")
      .select("id, name, slug, start_date, end_date, status, description, what_you_build")
      .eq("id", cycleId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

// Edit cycle "About" / information-page content (admin only).
export const PATCH = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const body = await parseBody(request, updateCycleDetailsSchema);
    if (isErrorResponse(body)) return body;

    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("cycles")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", cycleId)
      .select("id, name, status, description, what_you_build")
      .single();

    if (error) {
      return dbError(error, "cycle-details");
    }

    return NextResponse.json(data);
  }
);
