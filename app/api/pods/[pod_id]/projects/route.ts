import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { charterProjectSchema } from "@/lib/validations/workstreams";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// Chartering org projects — the voting path (solution_proposals ballot) is
// guarded off for org cycles (lib/cycle/guards.ts rejectOrgCycle); this is
// how workstream projects (e.g. the Triangulator) are born instead
// (docs/ORG_CYCLES.md §2, §5). A run's co-leads charter directly, and every
// active co-lead becomes a founding DRI on the new project.

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const body = await parseBody(request, charterProjectSchema);
    if (isErrorResponse(body)) return body;
    const { name, github_repo_url } = body;

    const { data: pod } = await auth.supabase
      .from("pods")
      .select("id, cycle_id, workstream_id, status, cycles (mode)")
      .eq("id", podId)
      .maybeSingle();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const cycleMode = (pod.cycles as unknown as { mode: string } | null)?.mode;
    if (cycleMode !== "org" || !pod.workstream_id) {
      return NextResponse.json(
        { error: "Projects are chartered only in organization workstreams" },
        { status: 400 }
      );
    }

    if (!isAdmin(auth.user) && !isModeratorForPod(auth.user, podId)) {
      return NextResponse.json(
        { error: "Only a workstream co-lead or admin can charter a project." },
        { status: 403 }
      );
    }

    const serviceClient = createServiceClient();

    // solution_proposal_id stays NULL — chartered, not voted (00060).
    const { data: project, error } = await serviceClient
      .from("projects")
      .insert({
        cycle_id: pod.cycle_id,
        pod_id: podId,
        name,
        status: "active",
        github_repo_url: github_repo_url || null,
      })
      .select("id")
      .single();

    if (error) {
      return dbError(error, "project-charter");
    }

    // Founding DRIs: every active co-lead on the run inherits a project_roles
    // 'dri' row. The project is brand new, so a conflict here would only
    // come from a duplicate moderator_assignments row — skip it rather than
    // fail the whole charter.
    const { data: coLeads } = await serviceClient
      .from("moderator_assignments")
      .select("participant_id")
      .eq("pod_id", podId)
      .is("removed_at", null);

    let dris = 0;
    for (const coLead of coLeads || []) {
      const { error: driError } = await serviceClient.from("project_roles").insert({
        participant_id: coLead.participant_id,
        project_id: project.id,
        role: "dri",
        invited_by: auth.user.participantId,
      });
      if (!driError) {
        dris++;
      } else if (driError.code !== "23505") {
        return dbError(driError, "project-charter-dri-seed");
      }
    }

    return NextResponse.json({ project_id: project.id, dris }, { status: 201 });
  }
);

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const { data, error } = await auth.supabase
      .from("projects")
      .select("id, name, status")
      .eq("pod_id", podId)
      .order("created_at");

    if (error) {
      return dbError(error, "pod-projects-list");
    }

    return NextResponse.json(data || []);
  }
);
