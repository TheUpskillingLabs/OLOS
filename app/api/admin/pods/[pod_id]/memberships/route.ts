import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { requireLabAccessForPod } from "@/lib/auth/lab";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { adminAddPodMembershipSchema } from "@/lib/validations/admin-pod-membership";
import {
  ensureActivePodMembership,
  reconcileEnrollmentActivation,
  reconcilePodMembers,
} from "@/lib/enrollment/reconciler";
import { grantRole } from "@/lib/auth/grants";
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
 *   - honors the per-cycle pod_limit cap (cycle_config.pod_limit, default 1)
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
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const podId = parseIntParam(params.pod_id, "pod_id");
    if (podId instanceof NextResponse) return podId;

    // Local Labs (docs/LOCAL_LABS.md): admin passes first; a lab lead may
    // manage pods in their own lab's cycles. HQ pods (lab_id NULL) resolve
    // to no lab and stay admin-only.
    const guard = await requireLabAccessForPod(auth.user, podId);
    if (guard) return guard;

    const body = await parseBody(request, adminAddPodMembershipSchema);
    if (isErrorResponse(body)) return body;
    const { participant_id, pod_role } = body;

    const client = createServiceClient();

    const { data: pod } = await client
      .from("pods")
      .select("id, cycle_id, status, lab_id, cycles!inner(mode)")
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
      .select("id, metro_id")
      .eq("id", participant_id)
      .maybeSingle();
    if (!participant) {
      return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    }

    // Pods are local (docs/LOCAL_LABS.md): requireLabAccessForPod above gates
    // the ACTING admin/lab-lead; this gates the TARGET — an open-cycle
    // lab-tagged pod only accepts that lab's members. Org runs (invite-only,
    // cross-lab by design) and NULL-lab/HQ pods are exempt, matching the DB
    // fence. Re-tag the member's lab or the pod's lab to override.
    const podMode = ((pod.cycles as unknown) as { mode: string } | null)?.mode;

    // pod_role pairs with org workstream runs only — same contract as
    // POST /api/invitations (co-lead/member are org concepts; an org add
    // without a role would be ambiguous about the moderator_assignments row).
    if (pod_role && podMode !== "org") {
      return NextResponse.json(
        { error: "Co-lead/member roles apply only to organization workstreams." },
        { status: 400 }
      );
    }
    if (!pod_role && podMode === "org") {
      return NextResponse.json(
        { error: "Organization workstream adds need a pod role (co-lead or member)." },
        { status: 400 }
      );
    }

    if (
      pod.lab_id !== null &&
      podMode === "open" &&
      participant.metro_id !== pod.lab_id
    ) {
      return NextResponse.json(
        {
          error:
            "This pod is local to its lab — that participant belongs to a different Local Lab.",
        },
        { status: 400 }
      );
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

    // Pods-per-member cap — reads cycle_config.pod_limit (default 1), the
    // same per-cycle admin setting the participant register route uses
    // (migration 00043 resolved roadmap §2.1's hardcoded-cap cleanup, so
    // both call sites now share one source of truth).
    const { data: podLimitConfig } = await client
      .from("cycle_config")
      .select("pod_limit")
      .eq("cycle_id", pod.cycle_id)
      .single();
    const podLimit = podLimitConfig?.pod_limit ?? 1;

    const { data: cyclePods } = await client
      .from("pod_memberships")
      .select("id, pods!inner(cycle_id)")
      .eq("participant_id", participant_id)
      .eq("pods.cycle_id", pod.cycle_id)
      .is("inactive_at", null);
    if ((cyclePods ?? []).length >= podLimit) {
      return NextResponse.json(
        {
          error:
            podLimit === 1
              ? "Participant is already in a pod for this cycle"
              : `Participant is already in ${podLimit} pods for this cycle`,
        },
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
    } else if (podMode === "org") {
      // Org runs charter as status:'active', so the forming→active branch
      // never fires — and reconcileEnrollmentActivation returns without
      // mutating when no cycle_enrollments row exists, which is exactly the
      // fresh-org-add case. ensureActivePodMembership (the primitive invite
      // fulfillment uses) is idempotent against the membership row created
      // above and upserts the active enrollment + seeds follows, keeping the
      // org roster (pod_memberships) and the Core Contributors tab / counts
      // (cycle_enrollments) in agreement.
      await ensureActivePodMembership(participant_id, podId, pod.cycle_id);
    } else {
      await reconcileEnrollmentActivation(participant_id, pod.cycle_id);
    }

    if (podMode === "org" && pod_role === "co_lead") {
      // Mirrors the org block of POST /api/pods/[pod_id]/moderators: record
      // the role through grants.ts FIRST so participant_roles carries
      // granted_by provenance (the moderator_assignments sync trigger then
      // no-ops on the row this created).
      const grant = await grantRole(client, {
        participantId: participant_id,
        role: "poderator",
        scope: { podId, cycleId: pod.cycle_id },
        actor: auth.user,
        scopeAuthorized: true,
        note: "org co-lead added by admin",
      });
      if (!grant.ok) {
        // Membership stands as a plain member; the admin can retry the
        // co-lead promotion via the Assign co-lead control.
        return NextResponse.json({ error: grant.error }, { status: grant.status });
      }
      // Upsert (fulfillment's shape, lib/auth/invitations.ts) rather than a
      // bare insert — a prior assignment row may exist from an earlier stint.
      const { error: assignError } = await client
        .from("moderator_assignments")
        .upsert(
          { participant_id, pod_id: podId, cycle_id: pod.cycle_id },
          { onConflict: "participant_id,pod_id,cycle_id", ignoreDuplicates: true }
        );
      if (assignError) return dbError(assignError);
    }

    return NextResponse.json(
      { pod_membership_id: membership.id, registered_at: membership.joined_at },
      { status: 201 }
    );
  }
);
