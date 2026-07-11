import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { checkWindow } from "@/lib/auth/windows";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { createServiceClient } from "@/lib/supabase/server";
import {
  reconcileEnrollmentActivation,
  reconcilePodMembers,
} from "@/lib/enrollment/reconciler";
import { requireCompleteProfile } from "@/lib/participants/placeholder";
import { rejectOrgCycle } from "@/lib/cycle/guards";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const POST = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const participantId = auth.user.participantId;

    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    const guard = await requireCompleteProfile(auth.supabase, participantId);
    if (guard) return guard;

    // Get pod to check status and cycle
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("id, cycle_id, status, lab_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const orgRejection = await rejectOrgCycle(
      auth.supabase,
      pod.cycle_id,
      "This is an organization workstream — membership is by invitation."
    );
    if (orgRejection) return orgRejection;

    // Pods are local (docs/LOCAL_LABS.md): a lab-tagged pod only accepts its
    // own lab's members. The DB fence (00068) backstops this; here we return a
    // friendly 403 instead of a raw constraint error. NULL-lab (HQ/
    // grandfathered) pods stay open.
    if (pod.lab_id !== null) {
      const { data: me } = await auth.supabase
        .from("participants")
        .select("metro_id")
        .eq("id", participantId)
        .maybeSingle();
      if (me?.metro_id !== pod.lab_id) {
        return NextResponse.json(
          {
            error: "This pod belongs to a different Local Lab.",
            redirect: "/local-labs",
          },
          { status: 403 }
        );
      }
    }

    if (!["forming", "active"].includes(pod.status)) {
      return NextResponse.json({ error: "Pod is not accepting registrations" }, { status: 400 });
    }

    // Check window
    const window = await checkWindow(auth.supabase, pod.cycle_id, "pod_registration");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Existing membership? Two cases:
    //   - Active (inactive_at IS NULL): true duplicate registration — bail
    //   - Inactive (inactive_at IS NOT NULL): reactivate by clearing inactive_at,
    //     preserves the original joined_at + audit trail (architecture brief §5
    //     "Soft delete everywhere, reactivation must be possible")
    const { data: existing } = await auth.supabase
      .from("pod_memberships")
      .select("id, inactive_at, joined_at")
      .eq("pod_id", podId)
      .eq("participant_id", participantId)
      .maybeSingle();

    if (existing && existing.inactive_at === null) {
      return NextResponse.json(
        { error: "You are already registered for this pod." },
        { status: 400 }
      );
    }

    const isReactivation = existing !== null;

    // Pods-per-member is a per-cycle admin setting (cycle_config.pod_limit,
    // default 1) — not a hardcoded constant (migration 00043). Read it, then
    // enforce it against this participant's active memberships in the cycle.
    const { data: podLimitConfig } = await createServiceClient()
      .from("cycle_config")
      .select("pod_limit")
      .eq("cycle_id", pod.cycle_id)
      .single();
    const podLimit = podLimitConfig?.pod_limit ?? 1;

    const { data: cyclePods } = await auth.supabase
      .from("pod_memberships")
      .select("id, pods!inner(cycle_id)")
      .eq("participant_id", participantId)
      .eq("pods.cycle_id", pod.cycle_id)
      .is("inactive_at", null);

    if ((cyclePods || []).length >= podLimit) {
      return NextResponse.json(
        {
          error:
            podLimit === 1
              ? "You're already in a pod for this cycle. Leave it first to switch pods."
              : `You're already in ${podLimit} pods for this cycle.`,
        },
        { status: 400 }
      );
    }

    let membership: { id: number; joined_at: string };
    if (isReactivation && existing) {
      const { data: reactivated, error: reactivateError } = await auth.supabase
        .from("pod_memberships")
        .update({ inactive_at: null })
        .eq("id", existing.id)
        .select("id, joined_at")
        .single();

      if (reactivateError) {
        return dbError(reactivateError);
      }
      membership = reactivated;
    } else {
      const { data: inserted, error: insertError } = await auth.supabase
        .from("pod_memberships")
        .insert({ participant_id: participantId, pod_id: podId })
        .select("id, joined_at")
        .single();

      if (insertError) {
        return dbError(insertError);
      }
      membership = inserted;
    }

    // Pod activation + enrollment reconciliation
    //
    // The pods.status flip (forming -> active) and the cycle_enrollments
    // status updates are both gated by is_admin_or_owner() RLS, so the
    // cookie-bound auth.supabase client would silently no-op them for
    // regular participants. We use the service client + the centralized
    // reconciler (lib/enrollment/reconciler.ts) instead — the single
    // source of truth for enrollment transitions across the codebase.
    const serviceClient = createServiceClient();

    const { data: config } = await serviceClient
      .from("cycle_config")
      .select("pod_min")
      .eq("cycle_id", pod.cycle_id)
      .single();

    const { count } = await serviceClient
      .from("pod_memberships")
      .select("id", { count: "exact", head: true })
      .eq("pod_id", podId)
      .is("inactive_at", null);

    if (config && count && count >= config.pod_min && pod.status === "forming") {
      // Pod just tipped past pod_min — flip to active, then reconcile every
      // member's enrollment so the resource-provisioning invariant holds
      // ("resources provision at activation" — architecture brief §4).
      await serviceClient
        .from("pods")
        .update({ status: "active" })
        .eq("id", podId);

      await reconcilePodMembers(podId);
    } else if (pod.status === "active") {
      // Pod was already active; reconcile only the joining participant.
      await reconcileEnrollmentActivation(participantId, pod.cycle_id);
    }

    return NextResponse.json(
      { pod_membership_id: membership.id, registered_at: membership.joined_at },
      { status: 201 }
    );
  }
);

export const DELETE = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;
    const participantId = auth.user.participantId;

    if (!participantId) {
      return NextResponse.json({ error: "Not a registered participant" }, { status: 403 });
    }

    // Get pod for window check + cycle reconciliation
    const { data: pod } = await auth.supabase
      .from("pods")
      .select("cycle_id")
      .eq("id", podId)
      .single();

    if (!pod) {
      return NextResponse.json({ error: "Pod not found" }, { status: 404 });
    }

    const window = await checkWindow(auth.supabase, pod.cycle_id, "pod_registration");
    if (!window.open) {
      return NextResponse.json({ error: window.message }, { status: 403 });
    }

    // Soft-delete per architecture brief §5: set inactive_at rather than DROP
    // the row. Preserves the audit trail and enables re-registration via the
    // reactivation path in POST above.
    const { error } = await auth.supabase
      .from("pod_memberships")
      .update({ inactive_at: new Date().toISOString() })
      .eq("pod_id", podId)
      .eq("participant_id", participantId)
      .is("inactive_at", null);

    if (error) {
      return dbError(error);
    }

    // Reconcile the leaver's enrollment — if this was their last active pod
    // in the cycle, their cycle_enrollments.status drops to 'inactive'.
    await reconcileEnrollmentActivation(participantId, pod.cycle_id);

    return NextResponse.json({ success: true });
  }
);
