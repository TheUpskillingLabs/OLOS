import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { checkWindow } from "@/lib/auth/windows";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";

export const POST = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;
    const participantId = auth.user.participantId;

    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Get project
    const { data: project } = await auth.supabase
      .from("projects")
      .select("id, pod_id, cycle_id, status")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check window
    const window = await checkWindow(auth.supabase, project.cycle_id, "project_registration");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Must be an active participant in THIS CYCLE (any pod).
    //
    // Previously this route required active membership in the project's own
    // pod, scoping registration to within-pod. That was a misread of the
    // architecture brief: Phase 5 (solution voting) is intentionally
    // within-pod, but Phase 7 (project self-registration) is meant to be
    // cycle-wide — any participant who is active in the cycle can join any
    // project that interests them. The pod-scope check was effectively
    // siloing participants to their proposing pod's project set, which
    // wasn't the intent.
    //
    // Authoritative check now: cycle_enrollments.status='active' for the
    // project's cycle. Phase A's reconciler (lib/enrollment/reconciler.ts)
    // keeps this status in sync with actual pod-membership reality, so an
    // 'active' enrollment implies the participant has at least one active
    // pod_membership in an active pod within the cycle — i.e. they're a
    // bona fide cohort member, just not necessarily of THIS pod.
    //
    // The 1-project-per-cycle cap below still applies, so a participant
    // can't register for more than one project per cycle regardless of
    // which pod the projects belong to.
    const { data: enrollment } = await auth.supabase
      .from("cycle_enrollments")
      .select("status")
      .eq("cycle_id", project.cycle_id)
      .eq("participant_id", participantId)
      .maybeSingle();

    if (!enrollment || enrollment.status !== "active") {
      return NextResponse.json(
        { error: "You must be an active participant in this cycle to register for a project." },
        { status: 400 }
      );
    }

    // Check 1-project-per-cycle cap (partial unique index also enforces this)
    const { data: existingProject } = await auth.supabase
      .from("project_memberships")
      .select("id")
      .eq("participant_id", participantId)
      .eq("cycle_id", project.cycle_id)
      .is("left_at", null)
      .maybeSingle();

    if (existingProject) {
      return NextResponse.json(
        {
          error:
            "You are already registered in a project for this cycle. Withdraw first to register for a different project.",
        },
        { status: 400 }
      );
    }

    // Check project_max
    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select("project_max, project_min")
      .eq("cycle_id", project.cycle_id)
      .single();

    const { count } = await auth.supabase
      .from("project_memberships")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("left_at", null);

    if (config && count !== null && count >= config.project_max) {
      return NextResponse.json(
        { error: "This project has reached its maximum registrant count." },
        { status: 400 }
      );
    }

    // Register
    const { data: membership, error } = await auth.supabase
      .from("project_memberships")
      .insert({
        participant_id: participantId,
        project_id: projectId,
        cycle_id: project.cycle_id,
      })
      .select("id, registered_at")
      .single();

    if (error) {
      return dbError(error);
    }

    // Check if project should activate
    const newCount = (count || 0) + 1;
    if (config && newCount >= config.project_min && project.status === "forming") {
      await auth.supabase
        .from("projects")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", projectId);
    }

    return NextResponse.json(
      { project_membership_id: membership.id, registered_at: membership.registered_at },
      { status: 201 }
    );
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

    // Get project for window check
    const { data: project } = await auth.supabase
      .from("projects")
      .select("cycle_id")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const window = await checkWindow(auth.supabase, project.cycle_id, "project_registration");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    const { error } = await auth.supabase
      .from("project_memberships")
      .update({ left_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("participant_id", participantId)
      .is("left_at", null);

    if (error) {
      return dbError(error);
    }

    return NextResponse.json({ success: true });
  }
);
