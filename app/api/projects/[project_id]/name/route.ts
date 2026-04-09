import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const PATCH = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseInt(params.project_id);

    // Get project to check pod for moderator access
    const { data: project } = await auth.supabase
      .from("projects")
      .select("pod_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!isAdmin(auth.user) && !auth.user.moderatorPodIds.includes(project.pod_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || name.length > 40 || name.trim().split(/\s+/).length > 3) {
      return NextResponse.json(
        { error: "Name must be 3 words or fewer and 40 characters or fewer" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("projects")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("id, name, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  }
);
