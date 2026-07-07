import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth, withAuth } from "@/lib/auth/middleware";
import { isAdmin } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { moderatorAssignmentSchema } from "@/lib/validations/pods";
import { createServiceClient } from "@/lib/supabase/server";
import { reconcileEnrollmentActivation } from "@/lib/enrollment/reconciler";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    if (!isAdmin(auth.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await auth.supabase
      .from("moderator_assignments")
      .select(`
        participant_id, assigned_at, removed_at,
        participants (first_name, last_name)
      `)
      .eq("pod_id", podId)
      .order("assigned_at");

    if (error) {
      return dbError(error);
    }

    const result = (data || []).map((a) => {
      const p = (a.participants as unknown) as Record<string, unknown>;
      return {
        participant_id: a.participant_id,
        name: `${p?.first_name || ""} ${p?.last_name || ""}`.trim(),
        assigned_at: a.assigned_at,
        removed_at: a.removed_at,
      };
    });

    return NextResponse.json(result);
  }
);

export const POST = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    // Fetch the pod up front — today's route trusted the body's cycle_id
    // without ever checking the pod exists. Validating here also gives us
    // cycles.mode, needed for the org co-lead branch below.
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("id, cycle_id, cycles (mode)")
      .eq("id", podId)
      .maybeSingle();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const body = await parseBody(request, moderatorAssignmentSchema);
    if (isErrorResponse(body)) return body;
    const { participant_id, cycle_id } = body;

    const { data, error } = await auth.supabase
      .from("moderator_assignments")
      .insert({ participant_id, pod_id: podId, cycle_id })
      .select("id, participant_id, pod_id, assigned_at")
      .single();

    if (error) {
      return dbError(error);
    }

    // Org co-leads are members of their workstream (docs/ORG_CYCLES.md);
    // participant-cycle poderators are deliberately NOT auto-membered — a
    // poderator shepherds a pod they don't sit in.
    const cycleMode = (pod.cycles as unknown as { mode: string } | null)?.mode;
    if (cycleMode === "org") {
      const serviceClient = createServiceClient();

      // Ensure an active membership, mirroring the reactivation pattern in
      // app/api/pods/[pod_id]/register/route.ts.
      const { data: existingMembership } = await serviceClient
        .from("pod_memberships")
        .select("id, inactive_at")
        .eq("pod_id", podId)
        .eq("participant_id", participant_id)
        .maybeSingle();

      if (existingMembership) {
        if (existingMembership.inactive_at !== null) {
          await serviceClient
            .from("pod_memberships")
            .update({ inactive_at: null })
            .eq("id", existingMembership.id);
        }
      } else {
        await serviceClient
          .from("pod_memberships")
          .insert({ participant_id, pod_id: podId });
      }

      await serviceClient
        .from("cycle_enrollments")
        .upsert(
          { participant_id, cycle_id: pod.cycle_id, status: "active" },
          { onConflict: "participant_id,cycle_id" }
        );

      // Load-bearing: promotes the enrollment to 'active' now that an active
      // pod_memberships row exists (lib/enrollment/reconciler.ts).
      await reconcileEnrollmentActivation(participant_id, pod.cycle_id);
    }

    return NextResponse.json(
      { moderator_assignment_id: data.id, ...data },
      { status: 201 }
    );
  }
);
