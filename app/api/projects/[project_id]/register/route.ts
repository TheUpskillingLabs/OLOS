import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { checkWindow } from "@/lib/auth/windows";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { rejectOrgCycle } from "@/lib/cycle/guards";
import { createServiceClient } from "@/lib/supabase/server";

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

    // Mirror the pod register route's allowlist (vibe-scan PP1): an
    // owner-archived project (status 'inactive') must not accept new
    // registrations. Withdrawal (DELETE below) stays status-agnostic —
    // members can always leave.
    if (!["forming", "active"].includes(project.status)) {
      return NextResponse.json(
        { error: "Project is not accepting registrations" },
        { status: 400 }
      );
    }

    const orgRejection = await rejectOrgCycle(
      auth.supabase,
      project.cycle_id,
      "Organization projects take contributors by invitation."
    );
    if (orgRejection) return orgRejection;

    // Check window
    const window = await checkWindow(auth.supabase, project.cycle_id, "project_registration");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Must be enrolled in THIS CYCLE in good standing (any pod, or no pod).
    //
    // Project registration is cycle-wide, not pod-scoped: Phase 5 (solution
    // voting) is intentionally within-pod, but Phase 7 (project
    // self-registration) lets any cohort member join any project that
    // interests them.
    //
    // The gate accepts 'registered' as well as 'active' — the same widening
    // isEnrolledParticipant (lib/auth/roles.ts) documents for the pre-pod
    // phases. 'active' means "has an active pod" (the reconciler only
    // promotes registered → active on pod membership), so gating on 'active'
    // alone locks out every cohort member who never landed in a pod — which,
    // under the 2026-08-26 direct-registration model (all pitches open to
    // everyone, no vote), is exactly who this phase must serve. 'inactive'
    // and 'revoked' remain excluded as genuine exits.
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

    if (!enrollment || !["registered", "active"].includes(enrollment.status)) {
      return NextResponse.json(
        { error: "You must be registered for this cycle to join a project." },
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

    // Register. Writes go through the service client: the guard chain above
    // (window, enrollment, 1-per-cycle, cap) already enforces everything the
    // RLS policies check, and the user-client write path is exposed to
    // current_participant_id() resolution, which rejects writes in prod —
    // the same failure mode already patched in the problem-statements and
    // votes routes. The DB backstops still hold either way: the
    // one_active_project_per_cycle partial unique index and the
    // project_membership_cap trigger (00101).
    const serviceClient = createServiceClient();

    // A prior withdrawn row for this same project must be reactivated, not
    // re-inserted — UNIQUE(participant_id, project_id) forbids a second row,
    // so withdraw-then-rejoin would otherwise fail on the insert.
    const { data: withdrawnRow } = await auth.supabase
      .from("project_memberships")
      .select("id")
      .eq("participant_id", participantId)
      .eq("project_id", projectId)
      .not("left_at", "is", null)
      .maybeSingle();

    const { data: membership, error } = withdrawnRow
      ? await serviceClient
          .from("project_memberships")
          .update({ left_at: null, registered_at: new Date().toISOString() })
          .eq("id", withdrawnRow.id)
          .select("id, registered_at")
          .single()
      : await serviceClient
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

    // Check if project should activate. Service client here too: the
    // projects_update RLS policy is admin-only, so the previous user-client
    // update silently matched zero rows for regular members and projects
    // never auto-activated at project_min.
    const newCount = (count || 0) + 1;
    if (config && newCount >= config.project_min && project.status === "forming") {
      await serviceClient
        .from("projects")
        .update({ status: "active" })
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
      .select("cycle_id, status")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const window = await checkWindow(auth.supabase, project.cycle_id, "project_registration");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Service client for the same reason as the register write above.
    const serviceClient = createServiceClient();
    const { error } = await serviceClient
      .from("project_memberships")
      .update({ left_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("participant_id", participantId)
      .is("left_at", null);

    if (error) {
      return dbError(error);
    }

    // Keep "viable" truthful: if the withdrawal drops the project below
    // project_min, demote active → forming — symmetric with the promotion
    // on register.
    if (project.status === "active") {
      const { data: config } = await auth.supabase
        .from("cycle_config")
        .select("project_min")
        .eq("cycle_id", project.cycle_id)
        .single();

      const { count } = await auth.supabase
        .from("project_memberships")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .is("left_at", null);

      if (config && count !== null && count < config.project_min) {
        await serviceClient
          .from("projects")
          .update({ status: "forming" })
          .eq("id", projectId)
          .eq("status", "active");
      }
    }

    return NextResponse.json({ success: true });
  }
);
