import { NextResponse, NextRequest } from "next/server";
import { withAuth, withAdminAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    let query = auth.supabase
      .from("cycles")
      .select("id, name, slug, start_date, end_date, status")
      .order("start_date", { ascending: false });

    // Non-admin users only see cycles they're enrolled in
    if (!isAdmin(auth.user) && !auth.user.roles.includes("observer")) {
      const enrolledCycleIds = auth.user.cycleEnrollments.map((e) => e.cycleId);
      if (enrolledCycleIds.length === 0) {
        return NextResponse.json([]);
      }
      query = query.in("id", enrolledCycleIds);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }
);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await request.json();
    const { name, slug, start_date, end_date } = body;

    if (!name || !start_date || !end_date) {
      return NextResponse.json(
        { error: "name, start_date, and end_date are required" },
        { status: 400 }
      );
    }

    // Create cycle
    const { data: cycle, error: cycleError } = await auth.supabase
      .from("cycles")
      .insert({ name, slug, start_date, end_date })
      .select()
      .single();

    if (cycleError) {
      return NextResponse.json({ error: cycleError.message }, { status: 500 });
    }

    // Create default config
    const { data: config, error: configError } = await auth.supabase
      .from("cycle_config")
      .insert({ cycle_id: cycle.id })
      .select()
      .single();

    if (configError) {
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    return NextResponse.json({ ...cycle, config }, { status: 201 });
  }
);
