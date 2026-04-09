import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    if (!isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: enrollments, error } = await auth.supabase
      .from("cycle_enrollments")
      .select(`
        participant_id,
        status,
        inactive_date,
        participants (
          id, first_name, last_name, preferred_name, email
        )
      `)
      .eq("cycle_id", cycleId);

    if (error) {
      return dbError(error);
    }

    // Get pod memberships for this cycle
    const { data: pods } = await auth.supabase
      .from("pod_memberships")
      .select("participant_id, pod_id, pods!inner(cycle_id)")
      .eq("pods.cycle_id", cycleId)
      .is("inactive_at", null);

    const podMap: Record<number, number[]> = {};
    if (pods) {
      for (const pm of pods) {
        if (!podMap[pm.participant_id]) podMap[pm.participant_id] = [];
        podMap[pm.participant_id].push(pm.pod_id);
      }
    }

    const result = enrollments?.map((e) => {
      const p = (e.participants as unknown) as Record<string, unknown>;
      return {
        participant_id: e.participant_id,
        first_name: p?.first_name,
        last_name: p?.last_name,
        preferred_name: p?.preferred_name,
        email: p?.email,
        status: e.status,
        inactive_date: e.inactive_date,
        pods: podMap[e.participant_id] || [],
      };
    });

    return NextResponse.json(result);
  }
);
