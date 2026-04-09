import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isActiveParticipant } from "@/lib/auth/roles";
import { checkWindow } from "@/lib/auth/windows";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await request.json();
    const { cycle_id, statement_text } = body;
    const participant_id = auth.user.participantId;

    if (!participant_id) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    if (!cycle_id || !statement_text) {
      return NextResponse.json({ error: "cycle_id and statement_text are required" }, { status: 400 });
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

    const { data, error } = await auth.supabase
      .from("problem_statements")
      .insert({ cycle_id, participant_id, statement_text })
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
