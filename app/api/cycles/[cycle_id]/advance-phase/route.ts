import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { can } from "@/lib/auth/roles";
import { createServiceClient } from "@/lib/supabase/server";
import { rejectOrgCycle } from "@/lib/cycle/guards";
import { finalizeProjectsForPod } from "@/lib/projects/finalize";
import { syncPhasesFromConfig } from "@/lib/cycles/schedule";

import { parseWindow } from "@/lib/cycles/lab-time";

const PHASE_SEQUENCE = [
  "problem_statement",
  "voting",
  "pod_registration",
  "solution_proposal",
  "solution_voting",
  "project_registration",
] as const;

type Phase = (typeof PHASE_SEQUENCE)[number];

export const POST = withAdminAuth(
  async (
    _request: NextRequest,
    auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    // Phase fast-forward is a testing tool — quarantined behind testing:use so
    // it matches the permission-gated Dev tab (a plain admin can't step phases).
    if (!can(auth.user, "testing:use")) {
      return NextResponse.json(
        { error: "Advancing phases requires the testing:use permission." },
        { status: 403 }
      );
    }

    const cycleId = parseInt(params.cycle_id);
    if (isNaN(cycleId)) {
      return NextResponse.json({ error: "Invalid cycle ID" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

    // Phase fast-forward steps formation windows and can force-activate a
    // draft — both meaningless (and corrupting) for org cycles, which have
    // no cycle_config formation windows and are never force-activated.
    const orgRejection = await rejectOrgCycle(
      serviceClient,
      cycleId,
      "Advance-phase applies only to participant cycles."
    );
    if (orgRejection) return orgRejection;

    // Fetch cycle config
    const { data: config, error: configError } = await serviceClient
      .from("cycle_config")
      .select("*")
      .eq("cycle_id", cycleId)
      .single();

    if (configError || !config) {
      return NextResponse.json(
        { error: "Cycle configuration not found" },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const configRecord = config as Record<string, unknown>;

    // Determine the current active phase (open <= now <= close).
    // parseWindow, not bare new Date(): the naive cycle_config timestamps
    // are UTC instants by convention (lib/cycles/lab-time.ts). new Date()
    // reads them in the server's local zone, which diverges between
    // Vercel (UTC) and a dev laptop — on localhost the just-opened phase
    // looked 4h in the future and the route re-opened voting forever.
    const nowDate = new Date(now);
    let currentActivePhase: Phase | null = null;
    for (const phase of PHASE_SEQUENCE) {
      const open = parseWindow(configRecord[`${phase}_open`] as string | null);
      const close = parseWindow(configRecord[`${phase}_close`] as string | null);
      if (open && close && open <= nowDate && nowDate <= close) {
        currentActivePhase = phase;
        break;
      }
    }

    // Find the last closed phase (close is in the past)
    let lastClosedIndex = -1;
    for (let i = PHASE_SEQUENCE.length - 1; i >= 0; i--) {
      const phase = PHASE_SEQUENCE[i];
      const close = parseWindow(configRecord[`${phase}_close`] as string | null);
      if (close && close <= nowDate) {
        lastClosedIndex = i;
        break;
      }
    }

    let nextPhaseIndex: number;
    const updates: Record<string, string> = {};

    if (currentActivePhase) {
      // Close the current phase
      const currentIndex = PHASE_SEQUENCE.indexOf(currentActivePhase);
      updates[`${currentActivePhase}_close`] = now;
      nextPhaseIndex = currentIndex + 1;
    } else if (lastClosedIndex >= 0) {
      // No phase currently open, open the one after the last closed
      nextPhaseIndex = lastClosedIndex + 1;
    } else {
      // No phases have ever been set, start from the beginning
      nextPhaseIndex = 0;
    }

    if (nextPhaseIndex >= PHASE_SEQUENCE.length) {
      return NextResponse.json({
        previous_phase: currentActivePhase,
        current_phase: null,
        message: "All phases have been completed for this cycle.",
      });
    }

    const nextPhase = PHASE_SEQUENCE[nextPhaseIndex];

    // Open the next phase: open = now, close = now + 24h
    const closeTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    updates[`${nextPhase}_open`] = now;
    updates[`${nextPhase}_close`] = closeTime;

    const { error: updateError } = await serviceClient
      .from("cycle_config")
      .update(updates)
      .eq("cycle_id", cycleId);

    if (updateError) {
      console.error("[ADVANCE_PHASE]", updateError.message);
      return NextResponse.json(
        { error: "Failed to update cycle configuration" },
        { status: 500 }
      );
    }

    // checkWindow is phases-first (lib/auth/windows.ts), so a raw
    // cycle_config write leaves the real gate on stale cycle_phases rows —
    // the tester "opens" a phase but participants still 403 (vibe-scan C2).
    // Mirror the config PATCH route: sync phases after every window write.
    await syncPhasesFromConfig(cycleId);

    // Ensure cycle is active. A no-op when already active; when promoting a
    // draft, the ≤1-active invariant (migration 00048) can reject it — surface
    // that as a clear 409 rather than an unhandled 500.
    const { error: activateError } = await serviceClient
      .from("cycles")
      .update({ status: "active" })
      .eq("id", cycleId)
      .eq("status", "draft");
    if (activateError) {
      return NextResponse.json(
        { error: "Another cycle is already active. Close it before advancing this draft cycle." },
        { status: 409 }
      );
    }

    // Opening project_registration implies the solution-voting results are
    // final — publish each pod's project shortlist now so the phase doesn't
    // open onto an empty registration page. Per-pod failures (already
    // finalized, no votes) are reported but never block the transition;
    // finalizeProjectsForPod is idempotent per pod.
    let projectsFinalized:
      | { pod_id: number; ok: boolean; created: number; error?: string }[]
      | undefined;
    if (nextPhase === "project_registration") {
      const { data: cyclePods } = await serviceClient
        .from("pods")
        .select("id")
        .eq("cycle_id", cycleId)
        .order("created_at");

      projectsFinalized = [];
      for (const pod of cyclePods ?? []) {
        try {
          const result = await finalizeProjectsForPod(pod.id);
          projectsFinalized.push(
            result.ok
              ? { pod_id: pod.id, ok: true, created: result.projects.length }
              : { pod_id: pod.id, ok: false, created: 0, error: result.error }
          );
        } catch (err) {
          console.error("[ADVANCE_PHASE] project finalize failed", pod.id, err);
          projectsFinalized.push({
            pod_id: pod.id,
            ok: false,
            created: 0,
            error: "Unexpected error while finalizing projects.",
          });
        }
      }
    }

    return NextResponse.json({
      previous_phase: currentActivePhase,
      current_phase: nextPhase,
      message: `Advanced to ${nextPhase.replace(/_/g, " ")} phase.`,
      ...(projectsFinalized ? { projects_finalized: projectsFinalized } : {}),
    });
  }
);
