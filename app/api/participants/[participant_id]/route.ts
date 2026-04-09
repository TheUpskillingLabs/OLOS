import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";

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
