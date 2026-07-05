import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { createServiceClient } from "@/lib/supabase/server";

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
    _auth: AuthenticatedRequest,
    params: Record<string, string>
  ) => {
    const cycleId = parseInt(params.cycle_id);
    if (isNaN(cycleId)) {
      return NextResponse.json({ error: "Invalid cycle ID" }, { status: 400 });
    }

    const serviceClient = createServiceClient();

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

    // Determine the current active phase (open <= now <= close)
    let currentActivePhase: Phase | null = null;
    for (const phase of PHASE_SEQUENCE) {
      const openTime = configRecord[`${phase}_open`] as string | null;
      const closeTime = configRecord[`${phase}_close`] as string | null;
      if (openTime && closeTime) {
        if (new Date(openTime) <= new Date(now) && new Date(now) <= new Date(closeTime)) {
          currentActivePhase = phase;
          break;
        }
      }
    }

    // Find the last closed phase (close is in the past)
    let lastClosedIndex = -1;
    for (let i = PHASE_SEQUENCE.length - 1; i >= 0; i--) {
      const phase = PHASE_SEQUENCE[i];
      const closeTime = configRecord[`${phase}_close`] as string | null;
      if (closeTime && new Date(closeTime) <= new Date(now)) {
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

    return NextResponse.json({
      previous_phase: currentActivePhase,
      current_phase: nextPhase,
      message: `Advanced to ${nextPhase.replace(/_/g, " ")} phase.`,
    });
  }
);
