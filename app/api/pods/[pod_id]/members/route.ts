import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
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
      return dbError(error);
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
