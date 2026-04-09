import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["closed"],
};

export const PATCH = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseInt(params.cycle_id);
    const body = await request.json();
    const { status } = body;

    if (!["draft", "active", "closed"].includes(status)) {
      return NextResponse.json(
        { error: "status must be one of: draft, active, closed" },
        { status: 400 }
      );
    }

    // Get current status
    const { data: cycle } = await auth.supabase
      .from("cycles")
      .select("status")
      .eq("id", cycleId)
      .single();

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    if (cycle.status === "closed") {
      return NextResponse.json(
        { error: "A closed cycle cannot be reopened." },
        { status: 400 }
      );
    }

    if (!VALID_TRANSITIONS[cycle.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${cycle.status}' to '${status}'.` },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("cycles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", cycleId)
      .select("id, name, status, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }
);
