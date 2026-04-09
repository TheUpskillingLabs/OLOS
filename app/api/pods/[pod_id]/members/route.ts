import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);
    const statusFilter = request.nextUrl.searchParams.get("status");

    let query = auth.supabase
      .from("pod_memberships")
      .select(`
        participant_id, joined_at, inactive_at,
        participants (first_name, last_name, preferred_name, email)
      `)
      .eq("pod_id", podId);

    if (statusFilter === "active") {
      query = query.is("inactive_at", null);
    } else if (statusFilter === "inactive") {
      query = query.not("inactive_at", "is", null);
    }

    const { data, error } = await query.order("joined_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((m) => {
      const p = (m.participants as unknown) as Record<string, unknown>;
      return {
        participant_id: m.participant_id,
        first_name: p?.first_name,
        last_name: p?.last_name,
        preferred_name: p?.preferred_name,
        email: p?.email,
        joined_at: m.joined_at,
        inactive_at: m.inactive_at,
      };
    });

    return NextResponse.json(result);
  }
);
