import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { adminAddPodMembershipSchema } from "@/lib/validations/admin-pod-membership";
import {
  reconcileEnrollmentActivation,
  reconcilePodMembers,
} from "@/lib/enrollment/reconciler";
import { createServiceClient } from "@/lib/supabase/server";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

/**
 * POST /api/admin/pods/[pod_id]/memberships
 *
 * Admin override of the participant-facing self-register route. Used to
 * place a participant in a pod on their behalf (e.g. operator reconciliation
 * for stranded enrollments — architecture review broken edge #13).
 *
 * Mirrors the participant register route's shape:
 *   - pod must exist + be forming/active
 *   - reactivates a soft-deleted membership if one exists (preserves
 *     joined_at and audit trail — architecture brief §5 invariant)
 *   - honors the 2-pod-per-cycle cap (architecture brief §3 invariant)
 *   - calls the Phase A reconciler so the participant's cycle_enrollments
 *     status reflects the new pod-membership reality
 *
 * Does NOT check the pod_registration window — admins are explicitly
 * allowed to act outside windows for remediation (architecture review §5.3
 * 'Admin overrides explicitly bypass via withAdminAuth'). The participant
 * route's checkWindow stays for self-registration; this admin route omits
 * it on purpose.
 *
 * === KNOWN GAP — admin audit trail ===
 *
 * This route mutates pod_memberships from an admin perspective WITHOUT
 * recording which admin made the change. If an admin removes Aaron from
 * Pod 5 today and a teammate asks "who did this?" tomorrow, there is no
 * answer in the database — only the inactive_at timestamp.
 *
 * The recommended follow-up is filed at #115 and adds:
 *   - added_by_admin_id  INT NULL REFERENCES participants(id)
 *   - removed_by_admin_id INT NULL REFERENCES participants(id)
 *   - removal_reason     VARCHAR(255)
 *   - admin_action_at    TIMESTAMP
 *
 * Once that migration ships, this route writes added_by_admin_id =
 * auth.user.participantId on the INSERT path, removed_by_admin_id +
 * removal_reason on the DELETE sibling, and admin_action_at on either.
 *
 * Why deferred: the consolidation in #110 is scoped to fixing the
 * state-machine fragmentation; admin observability is its own concern
 * worth landing as a focused PR after Phase B's primary surface
 * stabilizes. Architecture brief §5 ('Soft delete everywhere ... gives
 * us an audit trail') is honored at the row-existence level — rows are
 * preserved with inactive_at — just not at the actor level yet.
 *
 * Where this is headed: the admin audit pattern will become the template
 * for B.7 (pod-status override) and B.8 (reconciler-trigger from
 * stuck-inactive filter). All three routes should land their audit
 * columns in one coordinated migration rather than three separate
 * follow-ups. Tracked at #115.
 */
export const POST = withAdminAuth(
  async (request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    const body = await parseBody(request, adminAddPodMembershipSchema);
    if (isErrorResponse(body)) return body;
    const { participant_id } = body;

    const client = createServiceClient();

    const { data: pod } = await client
      .from("pods")
      .select("id, cycle_id, status")
      .eq("id", podId)
      .maybeSingle();
    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }
    if (!["forming", "active"].includes(pod.status)) {
      return NextResponse.json(
        { error: "Pod is not accepting memberships" },
        { status: 400 }
      );
    }

    const { data: participant } = await client
      .from("participants")
      .select("id")
      .eq("id", participant_id)
      .maybeSingle();
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    const { data: existing } = await client
      .from("pod_memberships")
      .select("id, inactive_at, joined_at")
      .eq("pod_id", podId)
      .eq("participant_id", participant_id)
      .maybeSingle();

    if (existing && existing.inactive_at === null) {
      return NextResponse.json(
        { error: "Participant is already a member of this pod" },
        { status: 400 }
      );
    }

    // 2-pod-per-cycle cap. NOTE: hardcoded as `>= 2` to match the
    // participant register route's existing behavior; roadmap §2.1
    // ('Move the hardcoded 2-pod cap to cycle_config.pod_limit')
    // tracks the cleanup that should update both call sites together.
    // Until §2.1 lands, the cap here MUST stay in sync with
    // app/api/pods/[pod_id]/register/route.ts.
    const { data: cyclePods } = await client
      .from("pod_memberships")
      .select("id, pods!inner(cycle_id)")
      .eq("participant_id", participant_id)
      .eq("pods.cycle_id", pod.cycle_id)
      .is("inactive_at", null);
    if ((cyclePods ?? []).length >= 2) {
      return NextResponse.json(
        { error: "Participant is already in 2 pods for this cycle" },
        { status: 400 }
      );
    }

    let membership: { id: number; joined_at: string };
    if (existing) {
      const { data: reactivated, error } = await client
        .from("pod_memberships")
        .update({ inactive_at: null })
        .eq("id", existing.id)
        .select("id, joined_at")
        .single();
      if (error) return dbError(error);
      membership = reactivated;
    } else {
      const { data: inserted, error } = await client
        .from("pod_memberships")
        .insert({ participant_id, pod_id: podId })
        .select("id, joined_at")
        .single();
      if (error) return dbError(error);
      membership = inserted;
    }

    // Pod auto-activation parity with the participant route.
    const { data: config } = await client
      .from("cycle_config")
      .select("pod_min")
      .eq("cycle_id", pod.cycle_id)
      .single();
    const { count } = await client
      .from("pod_memberships")
      .select("id", { count: "exact", head: true })
      .eq("pod_id", podId)
      .is("inactive_at", null);
    if (config && count && count >= config.pod_min && pod.status === "forming") {
      await client
        .from("pods")
        .update({ status: "active" })
        .eq("id", podId);
      await reconcilePodMembers(podId);
    } else {
      await reconcileEnrollmentActivation(participant_id, pod.cycle_id);
    }

    return NextResponse.json(
      { pod_membership_id: membership.id, registered_at: membership.joined_at },
      { status: 201 }
    );
  }
);
