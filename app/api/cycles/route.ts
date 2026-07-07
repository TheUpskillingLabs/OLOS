import { NextResponse, NextRequest } from "next/server";
import { withAuth, withAdminAuth } from "@/lib/auth/middleware";
import { isAdmin, can } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createCycleSchema } from "@/lib/validations/cycles";
import { createServiceClient } from "@/lib/supabase/server";

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
    const { name, slug, start_date, end_date, mode: bodyMode, sector_id: bodySectorId } = body;
    const mode = bodyMode ?? "open";

    // Org cycles need a sector_id; resolve the seeded HQ sector when the
    // caller doesn't supply one (docs/ORG_CYCLES.md §2). 'open' cycles pass
    // sector_id through unmodified if the caller happens to provide one.
    let sector_id = bodySectorId;
    if (mode === "org" && !sector_id) {
      const serviceClient = createServiceClient();
      const { data: hqSector } = await serviceClient
        .from("sectors")
        .select("id")
        .eq("slug", "the-upskilling-labs-hq")
        .maybeSingle();
      if (!hqSector) {
        return NextResponse.json(
          {
            error:
              'The seed sector "the-upskilling-labs-hq" is missing — org cycles require it. Re-run migration 00060.',
          },
          { status: 500 }
        );
      }
      sector_id = hqSector.id;
    }

    // Create cycle
    const cycleInsert: Record<string, unknown> = { name, slug, start_date, end_date, mode };
    if (sector_id) cycleInsert.sector_id = sector_id;

    const { data: cycle, error: cycleError } = await auth.supabase
      .from("cycles")
      .insert(cycleInsert)
      .select()
      .single();

    if (cycleError) {
      return dbError(cycleError);
    }

    // Default config. Org cycles get pod_limit=3 — staff sit on multiple
    // workstreams at once, unlike the participant default of 1
    // (docs/ORG_CYCLES.md §2) — and stay admin-editable from there.
    const configInsert: Record<string, unknown> = { cycle_id: cycle.id };
    if (mode === "org") configInsert.pod_limit = 3;

    const { data: config, error: configError } = await auth.supabase
      .from("cycle_config")
      .insert(configInsert)
      .select()
      .single();

    if (configError) {
      return dbError(configError);
    }

    return NextResponse.json({ ...cycle, config }, { status: 201 });
  }
);
