import { NextResponse, NextRequest } from "next/server";
import { withAuth, withAdminAuth } from "@/lib/auth/middleware";
import { isAdmin, can } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createCycleSchema } from "@/lib/validations/cycles";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    let query = auth.supabase
      .from("cycles")
      .select("id, name, slug, start_date, end_date, status")
      .order("start_date", { ascending: false });

    // Non-admin users only see cycles they're enrolled in (cycles:read grants full visibility)
    if (!isAdmin(auth.user) && !can(auth.user, "cycles:read")) {
      const enrolledCycleIds = auth.user.cycleEnrollments.map((e) => e.cycleId);
      if (enrolledCycleIds.length === 0) {
        return NextResponse.json([]);
      }
      query = query.in("id", enrolledCycleIds);
    }

    const { data, error } = await query;
    if (error) {
      return dbError(error);
    }
    return NextResponse.json(data);
  }
);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, createCycleSchema);
    if (isErrorResponse(body)) return body;
    const { name, slug, start_date, end_date } = body;

    // Create cycle
    const { data: cycle, error: cycleError } = await auth.supabase
      .from("cycles")
      .insert({ name, slug, start_date, end_date })
      .select()
      .single();

    if (cycleError) {
      return dbError(cycleError);
    }

    // Create default config
    const { data: config, error: configError } = await auth.supabase
      .from("cycle_config")
      .insert({ cycle_id: cycle.id })
      .select()
      .single();

    if (configError) {
      return dbError(configError);
    }

    return NextResponse.json({ ...cycle, config }, { status: 201 });
  }
);
