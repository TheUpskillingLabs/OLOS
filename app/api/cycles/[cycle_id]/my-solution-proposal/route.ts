import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

// Returns the current participant's solution_proposal for this cycle, or
// null. Drives "have I submitted?" gating across the W2-001 submission and
// voting tabs. Uses the (cycle_id, participant_id) unique constraint added
// in migration 00016 — at most one row.
export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json({ proposal: null });
    }

    const { data } = await auth.supabase
      .from("solution_proposals")
      .select(
        "id, cycle_id, pod_id, name, summary, proposal_data, proposal_text, created_at"
      )
      .eq("cycle_id", cycleId)
      .eq("participant_id", participantId)
      .maybeSingle();

    return NextResponse.json({ proposal: data ?? null });
  }
);
