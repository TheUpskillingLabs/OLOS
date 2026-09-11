import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { dbError } from "@/lib/api/errors";
import { adminProjectMembershipSchema } from "@/lib/validations/admin-project-membership";
import { reconcileEnrollmentActivation } from "@/lib/enrollment/reconciler";

/**
 * POST /api/admin/projects/[project_id]/memberships  { action: "add" | "move", … }
 *
 * Places a participant on a project, or moves them onto it from whichever
 * project they are currently on in that cycle.
 *
 * Both verbs delegate to SECURITY DEFINER RPCs (migration 00103) rather than
 * sequencing writes here, because each touches pod_memberships AND
 * project_memberships under invariants that must hold together: a cap
 * rejection on the project would otherwise strand the person in a pod they
 * were only added to for that project.
 *
 * CRITICAL: the RPCs are is_admin()-gated and is_admin() reads auth.uid(), so
 * they are invoked through `auth.supabase` (the request's user client) — NEVER
 * the service client, which has no auth.uid(). Same contract as the owner
 * lifecycle routes.
 *
 * Admins act outside registration windows on purpose — this is a remediation
 * surface, matching the admin pod membership route's stance.
 */

/**
 * The RPCs RAISE messages written for the admin reading them ("already on
 * another project… Use Move instead", "reached its maximum registrant count").
 * dbError deliberately sanitizes everything to a generic 500, which would throw
 * that guidance away, so operator-facing failures are surfaced as 400s and
 * anything unrecognized still falls through to the sanitized path.
 */
const OPERATOR_ERRORS = [
  "already on another project",
  "not on a project in this cycle",
  "already on that project",
  "maximum registrant count",
  "No such project",
];

function operatorMessage(error: { message?: string } | null): string | null {
  const msg = error?.message ?? "";
  return OPERATOR_ERRORS.some((fragment) => msg.includes(fragment)) ? msg : null;
}

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const projectId = parseIntParam(params.project_id, "project_id");
    if (projectId instanceof NextResponse) return projectId;

    const body = await parseBody(request, adminProjectMembershipSchema);
    if (isErrorResponse(body)) return body;

    const service = createServiceClient();
    const { data: project } = await service
      .from("projects")
      .select("id, pod_id, cycle_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const fn = body.action === "add" ? "admin_add_to_project" : "admin_move_project";
    const arg = body.action === "add" ? "p_project" : "p_to_project";

    const { error } = await auth.supabase.rpc(fn, {
      p_participant: body.participant_id,
      [arg]: projectId,
      p_reason: body.reason ?? null,
      p_override: body.override ?? false,
    });

    if (error) {
      const message = operatorMessage(error);
      if (message) return NextResponse.json({ error: message }, { status: 400 });
      return dbError(error, `admin-project-${body.action}`);
    }

    // Keep cycle_enrollments.status honest now that pod membership changed —
    // the same follow-up the admin pod membership route performs. Non-fatal:
    // the roster write already committed, and the reconciler is idempotent, so
    // a failure here self-corrects on its next run rather than undoing a
    // successful move.
    try {
      await reconcileEnrollmentActivation(body.participant_id, project.cycle_id);
    } catch (e) {
      console.error("[admin-project-membership] reconcile failed (non-fatal):", e);
    }

    return NextResponse.json({ ok: true, action: body.action });
  }
);
