import { NextResponse, NextRequest } from "next/server";
import { syncPhasesFromConfig } from "@/lib/cycles/schedule";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateCycleConfigSchema } from "@/lib/validations/cycles";
import { orgForbiddenConfigKeys } from "@/lib/cycle/guards";

export const GET = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data, error } = await auth.supabase
      .from("cycle_config")
      .select("*")
      .eq("cycle_id", cycleId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  }
);

export const PATCH = withAdminAuth(
  async (request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const body = await parseBody(request, updateCycleConfigSchema);
    if (isErrorResponse(body)) return body;

    // Org cycles have no formation windows or ballots (docs/ORG_CYCLES.md
    // §5) — reject phase-window/voting knobs outright rather than silently
    // accepting a no-op write. Open/closed cycles allow the full schema.
    const { data: cycle } = await auth.supabase
      .from("cycles")
      .select("mode")
      .eq("id", cycleId)
      .maybeSingle();

    if (cycle?.mode === "org") {
      const forbiddenKeys = orgForbiddenConfigKeys(body);
      if (forbiddenKeys.length > 0) {
        return NextResponse.json(
          { error: "Not configurable on an organization cycle: " + forbiddenKeys.join(", ") },
          { status: 400 }
        );
      }
    }

    const { data, error } = await auth.supabase
      .from("cycle_config")
      .update({ ...body })
      .eq("cycle_id", cycleId)
      .select()
      .single();

    if (error) {
      return dbError(error);
    }

    // Stage 1 calendar overhaul: keep the cycle_phases read model in sync
    // with the legacy columns (single write path — see
    // lib/cycles/schedule.ts). A sync failure must be loud, not silent:
    // divergent stores would gate members off the wrong clock.
    if (cycle?.mode !== "org") {
      try {
        await syncPhasesFromConfig(cycleId);
      } catch (e) {
        return NextResponse.json(
          {
            error: `Saved, but the phase schedule failed to sync: ${
              e instanceof Error ? e.message : "unknown error"
            }. Re-save to retry.`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(data);
  }
);
