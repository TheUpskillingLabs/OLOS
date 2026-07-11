import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { requireLabAccessForPod } from "@/lib/auth/lab";
import { finalizeProjectsForPod } from "@/lib/projects/finalize";
import { parseIntParam } from "@/lib/api/params";
import { rejectOrgCycle } from "@/lib/cycle/guards";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// Turns this pod's solution-proposal votes into projects. The tally/shortlist
// orchestration lives in lib/projects/finalize.ts so the phase-advance route
// (auto-finalize on entering project_registration) and the admin per-pod
// button share identical semantics with this endpoint.
//
// Authorized: admin, OR pod moderator, OR the lead of the pod's lab
// (Decision 6, PRD-lab-lead-ux, ratified) — a lab lead finalizes projects
// for their own lab's pods even without a moderator assignment on that pod.
export const POST = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    if (!isAdmin(auth.user) && !isModeratorForPod(auth.user, podId)) {
      const labGuard = await requireLabAccessForPod(auth.user, podId);
      if (labGuard) return labGuard;
    }

    // Get pod for cycle_id (org-mode gate below; the finalize helper
    // re-reads the pod for its own orchestration)
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const orgRejection = await rejectOrgCycle(
      auth.supabase,
      pod.cycle_id,
      "Organization projects are chartered by the workstream, not voted."
    );
    if (orgRejection) return orgRejection;

    const result = await finalizeProjectsForPod(podId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      projects: result.projects,
      eligible_proposals: result.eligible_proposals,
      ineligible_proposals: result.ineligible_proposals,
    });
  }
);
