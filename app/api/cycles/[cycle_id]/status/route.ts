import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleStatusSchema } from "@/lib/validations/cycles";
import { closeOutCycle } from "@/lib/cycle/closeout";
import { createServiceClient } from "@/lib/supabase/server";

// Cycle lifecycle (SECTOR_MODEL.md §4): draft → upcoming → active → closing →
// archived. 'closed' is retained as a legacy terminal for pre-sector cohorts.
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["upcoming", "active"],
  upcoming: ["active"],
  active: ["closing", "closed"],
  closing: ["archived"],
};

export const PATCH = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const body = await parseBody(request, updateCycleStatusSchema);
    if (isErrorResponse(body)) return body;
    const { status } = body;

    // Get current status
    const { data: cycle } = await auth.supabase
      .from("cycles")
      .select("status, mode, lab_id")
      .eq("id", cycleId)
      .single();

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    if (cycle.status === "closed" || cycle.status === "archived") {
      return NextResponse.json(
        { error: "A closed or archived cycle cannot be reopened." },
        { status: 400 }
      );
    }

    if (!VALID_TRANSITIONS[cycle.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${cycle.status}' to '${status}'.` },
        { status: 400 }
      );
    }

    // Sub-cohort model (00067): a live participant cycle is always HQ's —
    // labs join it as sub-cohorts, they don't run their own. The DB CHECK
    // (cycles_open_is_hq_when_live) is the backstop; this gives the clear
    // message. Residual per-lab open drafts can't be activated.
    if (
      (status === "active" || status === "upcoming") &&
      cycle.mode === "open" &&
      cycle.lab_id !== null
    ) {
      return NextResponse.json(
        {
          error:
            "Participant cycles are HQ-run — labs participate as sub-cohorts automatically and don't activate their own.",
        },
        { status: 400 }
      );
    }

    // At most one 'active' and one 'upcoming' cycle per stream — the
    // app-level twin of migration 00067's partial unique indexes. The
    // participant (open) track is ONE global HQ stream; org cycles remain
    // per-lab (each lab's internal team cycle alongside HQ's). Reject a
    // second one with a clear message instead of a raw unique-violation.
    // 'closed' mode cycles are legacy pre-sector cohorts with no invariant
    // yet — B2B concurrency is deferred, so the guard skips them.
    if ((status === "active" || status === "upcoming") && cycle.mode !== "closed") {
      let conflictQuery = auth.supabase
        .from("cycles")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
        .eq("mode", cycle.mode)
        .neq("id", cycleId);
      if (cycle.mode === "org") {
        conflictQuery =
          cycle.lab_id === null
            ? conflictQuery.is("lab_id", null)
            : conflictQuery.eq("lab_id", cycle.lab_id);
      }
      const { count } = await conflictQuery;
      if ((count ?? 0) > 0) {
        const modeLabel = cycle.mode === "org" ? "organization" : "open";
        const streamLabel =
          cycle.mode === "org" && cycle.lab_id !== null ? " in this lab" : "";
        return NextResponse.json(
          {
            error: `Another ${modeLabel} cycle is already ${status}${streamLabel}. Only one ${status} ${modeLabel} cycle is allowed at a time.`,
          },
          { status: 409 }
        );
      }
    }

    const { data, error } = await auth.supabase
      .from("cycles")
      .update({ status })
      .eq("id", cycleId)
      .select("id, name, status, updated_at")
      .single();

    if (error) {
      return dbError(error);
    }

    // Terminal transitions run the close-out (SECTOR_MODEL §6 /
    // docs/LOCAL_LABS.md): pods dissolve, memberships and poderator
    // assignments close, and projects graduate to sector governance —
    // "pods are ephemeral, projects go global." Idempotent, so a legacy
    // 'closed' followed by a later re-archive can't double-fire effects.
    if (status === "archived" || status === "closed") {
      const closeOut = await closeOutCycle(createServiceClient(), cycleId);
      return NextResponse.json({ ...data, close_out: closeOut });
    }

    return NextResponse.json(data);
  }
);
