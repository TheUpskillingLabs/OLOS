import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { participantsUpdateSchema } from "@/lib/validations/participants-update";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const participantId = parseIntParam(params.participant_id, "participant_id");
    if (participantId instanceof NextResponse) return participantId;

    // Only own record or admin
    if (participantId !== auth.user.participantId && !isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: participant, error } = await auth.supabase
      .from("participants")
      .select(`
        id, email, first_name, last_name, preferred_name,
        state, neighborhood, work_situation, main_focus,
        ai_tool_familiarity, participation_commitment
      `)
      .eq("id", participantId)
      .single();

    if (error || !participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Get multiselect options
    const { data: options } = await auth.supabase
      .from("participant_options")
      .select("option_id, option_lists(id, list_name, value)")
      .eq("participant_id", participantId);

    const grouped: Record<string, { id: number; value: string }[]> = {};
    for (const o of options || []) {
      const opt = (o.option_lists as unknown) as Record<string, unknown>;
      const listName = opt?.list_name as string;
      if (!grouped[listName]) grouped[listName] = [];
      grouped[listName].push({ id: opt?.id as number, value: opt?.value as string });
    }

    return NextResponse.json({
      ...participant,
      ai_tools: grouped["ai_tools"] || [],
      labs_goals: grouped["labs_goals"] || [],
      availability: grouped["availability"] || [],
      work_style: grouped["work_style"] || [],
      group_strengths: grouped["group_strengths"] || [],
    });
  }
);

/**
 * PATCH /api/participants/[participant_id]
 *
 * Partial update of a participant row. Powers three Phase B affordances
 * that share this single endpoint:
 *   - Mode A: voluntary self-edit from /profile/edit (auth = self)
 *   - Mode B: forced placeholder-name completion via layout redirect (auth = self)
 *   - Admin name-edit from /admin/participants/[id]/permissions (auth = admin)
 *
 * Authorization is application-layer (isSelf || isAdmin) with RLS as defense
 * in depth — migration 00021's WITH CHECK on participants_update_own enforces
 * the same predicate at the database level. The cookie-bound client is used
 * deliberately so RLS fires: if the application check ever drifted, the
 * write would still fail at the database layer rather than silently succeed.
 *
 * Body validation: lib/validations/participants-update.ts. The schema uses
 * .partial().strict() so only whitelisted fields can be touched (no
 * auth_user_id / email / id / etc. hijacking via tampered request bodies).
 */
export const PATCH = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const targetId = parseIntParam(params.participant_id, "participant_id");
    if (targetId instanceof NextResponse) return targetId;

    const isSelf = auth.user.participantId === targetId;
    if (!isSelf && !isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await parseBody(request, participantsUpdateSchema);
    if (isErrorResponse(body)) return body;

    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("participants")
      .update(body)
      .eq("id", targetId)
      .select("id, first_name, last_name, preferred_name, email, handle, headline, bio")
      .single();

    if (error) {
      // Unique-violation on the case-insensitive handle index → a clean 409
      // rather than a generic 500 (the profile editor surfaces this inline).
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That handle is already taken." },
          { status: 409 }
        );
      }
      return dbError(error, "patch-participant");
    }

    return NextResponse.json(data);
  }
);
