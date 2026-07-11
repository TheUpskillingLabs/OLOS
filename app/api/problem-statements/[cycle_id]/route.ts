import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    let query = auth.supabase
      .from("problem_statements")
      .select("id, participant_id, statement_text, proposal_data, created_at, metro_id")
      .eq("cycle_id", cycleId)
      .order("created_at");

    // Per-lab ballot (docs/LOCAL_LABS.md): a member sees only their own lab's
    // statements — you vote on the statements that form the pods you can join.
    // Admins see all (finalize preview / overview). A NULL-metro viewer sees
    // the grandfathered NULL bucket, so the live cycle stays coherent.
    if (!isAdmin(auth.user)) {
      const { data: me } = await auth.supabase
        .from("participants")
        .select("metro_id")
        .eq("id", auth.user.participantId ?? 0)
        .maybeSingle();
      query = me?.metro_id
        ? query.eq("metro_id", me.metro_id)
        : query.is("metro_id", null);
    }

    const { data, error } = await query;

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);
