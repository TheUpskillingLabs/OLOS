import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { parseIntParam } from "@/lib/api/params";
import { resolveStages, STAGE_CONFIG_COLUMNS, type StageConfig } from "@/lib/cycles/stages";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

// Resolved stage windows for a cycle — the data source for the client-side
// NextStepFooter (post-action "what's next / when" guidance). Read-only and
// non-sensitive: it's the same schedule already shown on the cycle detail page.
export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data: config } = await auth.supabase
      .from("cycle_config")
      .select(STAGE_CONFIG_COLUMNS)
      .eq("cycle_id", cycleId)
      .single();

    const stages = resolveStages((config ?? {}) as StageConfig);
    return NextResponse.json({ stages });
  }
);
