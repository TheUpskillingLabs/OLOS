import { NextResponse, NextRequest } from "next/server";
import { withAuth, withPermissionAuth } from "@/lib/auth/middleware";
import { isAdmin, can } from "@/lib/auth/roles";
import { isFullCycleAdmin } from "@/lib/auth/cycle-access";
import { createServiceClient } from "@/lib/supabase/server";
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

// HQ (cycles:write) creates any cycle and chooses its metro/kind. A local labs
// lead (pods:write, not cycles:write) may create a cycle only for their OWN lab:
// metro_slug is forced to their metro and is_hq_internal to false, so they can't
// mint HQ-open or other-lab cycles.
export const POST = withPermissionAuth(
  "pods:write",
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, createCycleSchema);
    if (isErrorResponse(body)) return body;
    const { name, slug, start_date, end_date } = body;

    const fullAdmin = isFullCycleAdmin(auth.user);

    let metro_slug: string | null;
    let is_hq_internal: boolean;
    if (fullAdmin) {
      metro_slug = body.metro_slug ?? null;
      is_hq_internal = body.is_hq_internal ?? false;
    } else {
      // A labs lead must carry a metro to own a cycle.
      if (!auth.user.metroSlug) {
        return NextResponse.json(
          { error: "You must be assigned to a lab (metro) to create a cycle." },
          { status: 403 }
        );
      }
      metro_slug = auth.user.metroSlug;
      is_hq_internal = false;
    }

    // Service client: cycles/cycle_config inserts are is_admin_or_owner()-gated
    // by RLS, which a labs lead is not; authorization is enforced above.
    const serviceClient = createServiceClient();

    const { data: cycle, error: cycleError } = await serviceClient
      .from("cycles")
      .insert({ name, slug, start_date, end_date, metro_slug, is_hq_internal })
      .select()
      .single();

    if (cycleError) {
      return dbError(cycleError);
    }

    // Create default config
    const { data: config, error: configError } = await serviceClient
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
