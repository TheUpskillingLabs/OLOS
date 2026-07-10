import { NextResponse, NextRequest } from "next/server";
import { withPermissionAuth } from "@/lib/auth/middleware";
import { requireCycleConfig } from "@/lib/auth/cycle-access";
import { createServiceClient } from "@/lib/supabase/server";
import { reconcilePodMembers } from "@/lib/enrollment/reconciler";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

/**
 * POST /api/admin/cycles/[cycle_id]/resolve-formation
 *
 * Failed-formation cleanup. Registration is best-effort self-service, so a pod
 * or project that never reaches its minimum size otherwise sits in 'forming'
 * forever. Once a registration window has closed, this dissolves under-filled
 * pods/projects (status -> 'inactive') and reconciles the enrollment status of
 * affected pod members.
 *
 * Cycle-scoped and admin-only. Writes run on the service client because
 * pods_update / projects_update / cycle_enrollments are is_admin_or_owner()-gated
 * (same reason the finalize and register routes reach for it).
 *
 * Idempotent: every dissolve is guarded by `status='forming'`, so re-runs (and
 * runs where nothing is under-min) are no-ops.
 *
 * Each layer is gated independently on its own registration window having
 * closed — we compare the `*_registration_close` timestamp to now directly
 * (checkWindow can't distinguish "before open" from "after close", and we only
 * want to act after close).
 */
export const POST = withPermissionAuth(
  "pods:write",
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    // Interim (Stage A): HQ, or a lab lead in their OWN local cycle. Stage B
    // scopes dissolve/reconcile per-lab inside shared HQ-open cycles.
    const guard = await requireCycleConfig(auth.supabase, auth.user, cycleId);
    if (guard) return guard;

    const client = createServiceClient();

    const { data: config } = await client
      .from("cycle_config")
      .select(
        "pod_min, project_min, pod_registration_close, project_registration_close"
      )
      .eq("cycle_id", cycleId)
      .single();

    if (!config) {
      return NextResponse.json({ error: "Cycle config not found" }, { status: 404 });
    }

    const now = new Date();
    const podsResolvable =
      config.pod_registration_close != null &&
      new Date(config.pod_registration_close) < now;
    const projectsResolvable =
      config.project_registration_close != null &&
      new Date(config.project_registration_close) < now;

    if (!podsResolvable && !projectsResolvable) {
      return NextResponse.json(
        {
          error:
            "Registration windows are still open (or unset); cannot resolve formation yet.",
        },
        { status: 403 }
      );
    }

    let podsDissolved = 0;
    let enrollmentsDeactivated = 0;
    let projectsDissolved = 0;

    // ── Pods ──────────────────────────────────────────────────────────────
    if (podsResolvable) {
      const podMin = Math.max(1, config.pod_min);
      const { data: formingPods } = await client
        .from("pods")
        .select("id")
        .eq("cycle_id", cycleId)
        .eq("status", "forming");

      for (const pod of formingPods ?? []) {
        const { count } = await client
          .from("pod_memberships")
          .select("id", { count: "exact", head: true })
          .eq("pod_id", pod.id)
          .is("inactive_at", null);

        if ((count ?? 0) < podMin) {
          const { data: updated } = await client
            .from("pods")
            .update({ status: "inactive", updated_at: now.toISOString() })
            .eq("id", pod.id)
            .eq("status", "forming")
            .select("id")
            .maybeSingle();

          if (updated) {
            podsDissolved += 1;
            // The pod is no longer active, so each member's enrollment
            // reconciles toward 'inactive' unless they hold another active pod.
            const results = await reconcilePodMembers(pod.id);
            enrollmentsDeactivated += results.filter(
              (r) => r.mutated && r.after === "inactive"
            ).length;
          }
        }
      }
    }

    // ── Projects ──────────────────────────────────────────────────────────
    if (projectsResolvable) {
      const projectMin = Math.max(1, config.project_min);
      const { data: formingProjects } = await client
        .from("projects")
        .select("id")
        .eq("cycle_id", cycleId)
        .eq("status", "forming");

      for (const project of formingProjects ?? []) {
        const { count } = await client
          .from("project_memberships")
          .select("id", { count: "exact", head: true })
          .eq("project_id", project.id)
          .is("left_at", null);

        if ((count ?? 0) < projectMin) {
          const { data: updated } = await client
            .from("projects")
            .update({ status: "inactive", updated_at: now.toISOString() })
            .eq("id", project.id)
            .eq("status", "forming")
            .select("id")
            .maybeSingle();

          if (updated) {
            projectsDissolved += 1;
            // No enrollment reconcile: cycle_enrollments status is defined by
            // pod-membership reality, which a dissolved project does not change.
          }
        }
      }
    }

    return NextResponse.json({
      pods_dissolved: podsDissolved,
      projects_dissolved: projectsDissolved,
      enrollments_deactivated: enrollmentsDeactivated,
      window: { podsResolvable, projectsResolvable },
    });
  }
);
