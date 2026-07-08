import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { requireLabAccessForPod } from "@/lib/auth/lab";
import { isAdmin } from "@/lib/auth/roles";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { moderatorAssignmentSchema } from "@/lib/validations/pods";
import { ensureActivePodMembership } from "@/lib/enrollment/reconciler";
import { one } from "@/lib/supabase/embed";
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

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    // Local Labs (docs/LOCAL_LABS.md): admin passes first; a lab lead may
    // assign poderators/co-leads on pods in their own lab's cycles. HQ
    // pods stay admin-only.
    const guard = await requireLabAccessForPod(auth.user, podId);
    if (guard) return guard;

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

    // The pod's own cycle_id is authoritative — a client-supplied mismatch
    // would otherwise write a moderator_assignments row for a cycle the pod
    // doesn't belong to.
    if (cycle_id !== pod.cycle_id) {
      return NextResponse.json(
        { error: "cycle_id does not match the pod's cycle" },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("moderator_assignments")
      .insert({ participant_id, pod_id: podId, cycle_id: pod.cycle_id })
      .select("id, participant_id, pod_id, assigned_at")
      .single();

    if (error) {
      return dbError(error);
    }

    // Org co-leads are members of their workstream (docs/ORG_CYCLES.md);
    // participant-cycle poderators are deliberately NOT auto-membered — a
    // poderator shepherds a pod they don't sit in.
    const cycleMode = one(pod.cycles as { mode: string } | { mode: string }[] | null)?.mode;
    if (cycleMode === "org") {
      // Single path an org co-lead/member joins a workstream through
      // (lib/enrollment/reconciler.ts).
      await ensureActivePodMembership(participant_id, podId, pod.cycle_id);
    }

    return NextResponse.json(
      { moderator_assignment_id: data.id, ...data },
      { status: 201 }
    );
  }
);
