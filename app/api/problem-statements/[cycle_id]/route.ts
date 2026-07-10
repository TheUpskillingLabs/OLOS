import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { isFullCycleAdmin } from "@/lib/auth/cycle-access";
import { createServiceClient } from "@/lib/supabase/server";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";

export const GET = withAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest, params: Record<string, string>) => {
    const cycleId = parseIntParam(params.cycle_id, "cycle_id");
    if (cycleId instanceof NextResponse) return cycleId;

    const { data, error } = await auth.supabase
      .from("problem_statements")
      .select("id, participant_id, statement_text, proposal_data, created_at")
      .eq("cycle_id", cycleId)
      .order("created_at");

    if (error) {
      return dbError(error);
    }

    // Per-lab pool: in an HQ-open cycle, everyone but a full admin sees only
    // their own lab's statements (participants vote within their lab; a labs
    // lead sees their lab's tallies). Full admins and local-lab cycles are
    // unscoped. Author labs are read via the service client since a participant
    // can't read others' rows under RLS; statement-level RLS still applies to
    // the list above.
    const { data: cyc } = await auth.supabase
      .from("cycles")
      .select("metro_slug")
      .eq("id", cycleId)
      .maybeSingle();

    let rows = data ?? [];
    if (cyc && cyc.metro_slug === null && !isFullCycleAdmin(auth.user)) {
      const lab = auth.user.metroSlug;
      if (!lab) {
        rows = [];
      } else {
        const svc = createServiceClient();
        const authorIds = [...new Set(rows.map((r) => r.participant_id))];
        const { data: authors } = await svc
          .from("participants")
          .select("id, metro_slug")
          .in("id", authorIds.length ? authorIds : [0]);
        const metroById = new Map((authors ?? []).map((a) => [a.id, a.metro_slug]));
        rows = rows.filter((r) => metroById.get(r.participant_id) === lab);
      }
    }

    return NextResponse.json(rows);
  }
);
