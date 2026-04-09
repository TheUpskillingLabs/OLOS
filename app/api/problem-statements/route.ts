import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isActiveParticipant } from "@/lib/auth/roles";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { problemStatementSchema } from "@/lib/validations/votes";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, problemStatementSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id, statement_text, proposal_data } = body;
    const participant_id = auth.user.participantId;

    if (!participant_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Check window
    const window = await checkWindow(auth.supabase, cycle_id, "problem_statement");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Check active enrollment
    if (!isActiveParticipant(auth.user, cycle_id)) {
      return NextResponse.json({ error: "You must be an active participant in this cycle" }, { status: 403 });
    }

    const row: Record<string, unknown> = { cycle_id, participant_id, statement_text };
    if (proposal_data) row.proposal_data = proposal_data;

    const { data, error } = await auth.supabase
      .from("problem_statements")
      .insert(row)
      .select("id, created_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data, { status: 201 });
  }
);
