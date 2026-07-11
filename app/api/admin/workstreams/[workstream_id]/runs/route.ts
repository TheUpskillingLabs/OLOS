import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireLabAccess } from "@/lib/auth/lab";
import { isAdmin } from "@/lib/auth/roles";
import { grantRole } from "@/lib/auth/grants";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createRunSchema } from "@/lib/validations/workstreams";
import { createServiceClient } from "@/lib/supabase/server";
import { reconcilePodMembers } from "@/lib/enrollment/reconciler";

/**
 * POST /api/admin/workstreams/[workstream_id]/runs
 *
 * Charters a workstream's run for a target org cycle — a `pods` row with
 * `workstream_id` set and `problem_statement_id` NULL, since a run is
 * chartered directly rather than voted into existence (docs/ORG_CYCLES.md
 * §2/§5). Optionally copies the prior run's roster forward
 * (`copy_from_cycle_id`) per §5's manual-rollover primitive.
 */
export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const workstreamId = parseIntParam(params.workstream_id, "workstream_id");
    if (workstreamId instanceof NextResponse) return workstreamId;

    const body = await parseBody(request, createRunSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id, copy_from_cycle_id } = body;

    const client = createServiceClient();

    const { data: workstream } = await client
      .from("workstreams")
      .select("id, name, status, lab_id")
      .eq("id", workstreamId)
      .maybeSingle();
    if (!workstream) {
      return NextResponse.json({ error: "Workstream not found" }, { status: 404 });
    }

    // Local Labs (docs/LOCAL_LABS.md): admin passes first; a lab lead may
    // charter runs for their own lab's workstreams. HQ (sector-homed)
    // workstreams resolve to no lab and stay admin-only.
    if (!isAdmin(auth.user)) {
      const guard = requireLabAccess(auth.user, workstream.lab_id ?? null);
      if (guard) return guard;
    }

    if (workstream.status !== "active") {
      return NextResponse.json(
        { error: "This workstream is dormant and cannot start a new run." },
        { status: 400 }
      );
    }

    const { data: cycle } = await client
      .from("cycles")
      .select("id, mode, status, lab_id")
      .eq("id", cycle_id)
      .maybeSingle();
    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }
    // A run lives in its workstream's stream: HQ workstreams charter into
    // HQ org cycles, a lab's into that same lab's — for everyone, admins
    // included; a cross-stream run would orphan the roster's lab identity.
    if ((workstream.lab_id ?? null) !== (cycle.lab_id ?? null)) {
      return NextResponse.json(
        { error: "The run's cycle must belong to the same lab as the workstream." },
        { status: 400 }
      );
    }
    if (cycle.mode !== "org") {
      return NextResponse.json(
        { error: "Runs can only be created in organization cycles" },
        { status: 400 }
      );
    }
    if (["closed", "archived"].includes(cycle.status)) {
      return NextResponse.json(
        { error: `Cannot create a run in a ${cycle.status} cycle` },
        { status: 400 }
      );
    }

    // Validate the copy source *before* creating the run pod, so a bad
    // copy_from_cycle_id fails the whole request instead of leaving behind
    // an orphan, roster-less run that a retry then collides with (23505).
    let sourceRun: { id: number } | null = null;
    if (copy_from_cycle_id) {
      const { data } = await client
        .from("pods")
        .select("id")
        .eq("workstream_id", workstreamId)
        .eq("cycle_id", copy_from_cycle_id)
        .maybeSingle();
      if (!data) {
        return NextResponse.json(
          { error: "No run found for this workstream in the source cycle" },
          { status: 404 }
        );
      }
      sourceRun = data;
    }

    const { data: run, error: runError } = await client
      .from("pods")
      .insert({
        cycle_id,
        workstream_id: workstreamId,
        name: workstream.name,
        status: "active",
        problem_statement_id: null,
        // Sub-cohort tag (pods.lab_id): a lab workstream's run belongs to
        // that lab; HQ workstreams (lab_id NULL) charter HQ runs.
        lab_id: workstream.lab_id ?? null,
      })
      .select("id")
      .single();

    if (runError) {
      if (runError.code === "23505") {
        return NextResponse.json(
          { error: "This workstream already has a run in that cycle" },
          { status: 409 }
        );
      }
      return dbError(runError);
    }

    const podId = run.id;
    let copiedMembers = 0;
    let copiedModerators = 0;

    if (sourceRun) {
      const { data: sourceMembers } = await client
        .from("pod_memberships")
        .select("participant_id")
        .eq("pod_id", sourceRun.id)
        .is("inactive_at", null);
      const { data: sourceModerators } = await client
        .from("moderator_assignments")
        .select("participant_id")
        .eq("pod_id", sourceRun.id)
        .is("removed_at", null);

      const memberIds = (sourceMembers ?? []).map((m) => m.participant_id);
      const moderatorIds = (sourceModerators ?? []).map((m) => m.participant_id);

      if (memberIds.length > 0) {
        const { error: membershipError } = await client
          .from("pod_memberships")
          .insert(memberIds.map((participant_id) => ({ participant_id, pod_id: podId })));
        if (membershipError) return dbError(membershipError);
        copiedMembers = memberIds.length;
      }

      if (moderatorIds.length > 0) {
        // Record each copied poderator through grants.ts first (provenance:
        // the chartering admin re-grants for the new cycle), so the
        // participant_roles rows carry granted_by rather than the sync
        // trigger's null. The moderator_assignments insert then no-ops the
        // rows in the trigger.
        for (const participant_id of moderatorIds) {
          await grantRole(client, {
            participantId: participant_id,
            role: "poderator",
            scope: { podId, cycleId: cycle_id },
            actor: auth.user,
            scopeAuthorized: true,
            note: "poderator copied forward at charter",
          });
        }
        const { error: moderatorError } = await client
          .from("moderator_assignments")
          .insert(
            moderatorIds.map((participant_id) => ({
              participant_id,
              pod_id: podId,
              cycle_id,
            }))
          );
        if (moderatorError) return dbError(moderatorError);
        copiedModerators = moderatorIds.length;
      }

      // Give the reconciler a cycle_enrollments row to activate for every
      // copied member — one batched upsert (same pattern already used
      // below for pod_memberships / moderator_assignments) instead of a
      // sequential per-member round trip.
      if (memberIds.length > 0) {
        const { error: enrollError } = await client
          .from("cycle_enrollments")
          .upsert(
            memberIds.map((participant_id) => ({
              participant_id,
              cycle_id,
              status: "active",
            })),
            { onConflict: "participant_id,cycle_id" }
          );
        if (enrollError) return dbError(enrollError);
      }

      await reconcilePodMembers(podId);
    }

    return NextResponse.json(
      { pod_id: podId, copied_members: copiedMembers, copied_moderators: copiedModerators },
      { status: 201 }
    );
  }
);
