import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth, withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);

    if (!isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await auth.supabase
      .from("moderator_assignments")
      .select(`
        participant_id, assigned_at, removed_at,
        participants (first_name, last_name)
      `)
      .eq("pod_id", podId)
      .order("assigned_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data || []).map((a) => {
      const p = (a.participants as unknown) as Record<string, unknown>;
      return {
        participant_id: a.participant_id,
        name: `${p?.first_name || ""} ${p?.last_name || ""}`.trim(),
        assigned_at: a.assigned_at,
        removed_at: a.removed_at,
      };
    });

    return NextResponse.json(result);
  }
);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);
    const body = await request.json();
    const { participant_id, cycle_id } = body;

    if (!participant_id || !cycle_id) {
      return NextResponse.json(
        { error: "participant_id and cycle_id are required" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("moderator_assignments")
      .insert({ participant_id, pod_id: podId, cycle_id })
      .select("id, participant_id, pod_id, assigned_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { moderator_assignment_id: data.id, ...data },
      { status: 201 }
    );
  }
);
