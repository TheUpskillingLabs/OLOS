import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await request.json();
    const { participant_id } = body;

    if (!participant_id) {
      return NextResponse.json({ error: "participant_id is required" }, { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("user_roles")
      .insert({
        participant_id,
        role: "observer",
        granted_by: auth.user.participantId,
      })
      .select("id, granted_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
