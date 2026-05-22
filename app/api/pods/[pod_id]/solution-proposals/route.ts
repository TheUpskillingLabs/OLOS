import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { solutionProposalSchema } from "@/lib/validations/pods";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const { data, error } = await auth.supabase
      .from("solution_proposals")
      .select(
        "id, participant_id, name, summary, proposal_data, proposal_text, created_at"
      )
      .eq("pod_id", podId)
      .order("created_at");

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data);
  }
);

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const participantId = auth.user.participantId;

    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const body = await parseBody(request, solutionProposalSchema);
    if (isErrorResponse(body)) return body;
    const {
      name,
      summary,
      description,
      pod_problem_link,
      why_now,
      mvp_scope,
      skills_wanted,
    } = body;

    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const window = await checkWindow(auth.supabase, pod.cycle_id, "solution_proposal");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

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

    // UPSERT on (cycle_id, participant_id) — one submission per participant per
    // cycle, but editable until solution_proposal_close (per ISSUE-W2-001 D3).
    // Migration 00016 added the unique index that's our conflict target.
    const proposalData = {
      description,
      ...(pod_problem_link ? { pod_problem_link } : {}),
      ...(why_now ? { why_now } : {}),
      ...(mvp_scope ? { mvp_scope } : {}),
      ...(skills_wanted ? { skills_wanted } : {}),
    };

    const { data, error } = await auth.supabase
      .from("solution_proposals")
      .upsert(
        {
          cycle_id: pod.cycle_id,
          pod_id: podId,
          participant_id: participantId,
          name,
          summary,
          proposal_data: proposalData,
        },
        { onConflict: "cycle_id,participant_id" }
      )
      .select("id, name, summary, proposal_data, pod_id, created_at")
      .single();

    if (error) {
      return dbError(error);
    }

    return NextResponse.json(data, { status: 201 });
  }
);
