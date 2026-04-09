import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { checkWindow } from "@/lib/auth/windows";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);

    const { data, error } = await auth.supabase
      .from("solution_proposals")
      .select("id, participant_id, proposal_text, created_at")
      .eq("pod_id", podId)
      .order("created_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }
);

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseInt(params.pod_id);
    const participantId = auth.user.participantId;
    const body = await request.json();
    const { proposal_text } = body;

    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    if (!proposal_text) {
      return NextResponse.json({ error: "proposal_text is required" }, { status: 400 });
    }

    // Get pod for cycle_id
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    // Check window
    const window = await checkWindow(auth.supabase, pod.cycle_id, "solution_proposal");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Check active pod membership
    const { data: membership } = await auth.supabase
      .from("pod_memberships")
      .select("id")
      .eq("pod_id", podId)
      .eq("participant_id", participantId)
      .is("inactive_at", null)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "You must be an active member of this pod" },
        { status: 403 }
      );
    }

    const { data, error } = await auth.supabase
      .from("solution_proposals")
      .insert({
        cycle_id: pod.cycle_id,
        pod_id: podId,
        participant_id: participantId,
        proposal_text,
      })
      .select("id, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }
);
