import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// Self-serve follow of a project — the IC ladder's entry point
// (project_subscriptions, migration 00060 / docs/ORG_CYCLES.md §2). RLS on
// project_subscriptions is self select/insert/delete via
// current_participant_id(), so the cookie-bound auth.supabase client
// enforces identity on its own; no service client needed here.

export const POST = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const { data: project } = await auth.supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { error } = await auth.supabase
      .from("project_subscriptions")
      .insert({ participant_id: participantId, project_id: projectId });

    if (error) {
      // 23505 = unique_violation — already following; idempotent.
      if (error.code === "23505") {
        return NextResponse.json({ following: true }, { status: 200 });
      }
      return dbError(error, "project-follow");
    }

    return NextResponse.json({ following: true }, { status: 201 });
  }
);

export const DELETE = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const participantId = auth.user.participantId;
    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Idempotent unfollow — no existence check needed: whether or not a row
    // was there, the caller now isn't following. Always 200.
    await auth.supabase
      .from("project_subscriptions")
      .delete()
      .eq("participant_id", participantId)
      .eq("project_id", projectId);

    return NextResponse.json({ following: false });
  }
);
