import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
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
export const POST = withAdminAuth(
  async (request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const workstreamId = parseIntParam(params.workstream_id, "workstream_id");
    if (workstreamId instanceof NextResponse) return workstreamId;

    const body = await parseBody(request, createRunSchema);
    if (isErrorResponse(body)) return body;
    const { cycle_id, copy_from_cycle_id } = body;

    const client = createServiceClient();

    const { data: workstream } = await client
      .from("workstreams")
      .select("id, name, status")
      .eq("id", workstreamId)
      .maybeSingle();
    if (!workstream) {
      return NextResponse.json({ error: "Workstream not found" }, { status: 404 });
    }
    if (workstream.status !== "active") {
      return NextResponse.json(
        { error: "This workstream is dormant and cannot start a new run." },
        { status: 400 }
      );
    }

    const { data: cycle } = await client
      .from("cycles")
      .select("id, mode, status")
      .eq("id", cycle_id)
      .maybeSingle();
    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
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

    const { data: run, error: runError } = await client
      .from("pods")
      .insert({
        cycle_id,
        workstream_id: workstreamId,
        name: workstream.name,
        status: "active",
        problem_statement_id: null,
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

    if (copy_from_cycle_id) {
      const { data: sourceRun } = await client
        .from("pods")
        .select("id")
        .eq("workstream_id", workstreamId)
        .eq("cycle_id", copy_from_cycle_id)
        .maybeSingle();
      if (!sourceRun) {
        return NextResponse.json(
          { error: "No run found for this workstream in the source cycle" },
          { status: 404 }
        );
      }

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
      // copied member (same upsert pattern as fulfillInvitation,
      // lib/auth/invitations.ts:100-106).
      for (const participant_id of memberIds) {
        await client
          .from("cycle_enrollments")
          .upsert(
            { participant_id, cycle_id, status: "active" },
            { onConflict: "participant_id,cycle_id" }
          );
      }

      await reconcilePodMembers(podId);
    }

    return NextResponse.json(
      { pod_id: podId, copied_members: copiedMembers, copied_moderators: copiedModerators },
      { status: 201 }
    );
  }
);
