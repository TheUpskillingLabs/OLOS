import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseIntParam } from "@/lib/api/params";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { updateWorkstreamSchema } from "@/lib/validations/workstreams";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * PATCH /api/admin/workstreams/[workstream_id]
 *
 * Edits a workstream's name/description/status. Renaming a workstream
 * deliberately does NOT rename existing run pods — a run copies
 * `workstreams.name` onto its `pods.name` verbatim at charter time (see
 * `POST /api/admin/workstreams/[workstream_id]/runs`), and that history
 * stays as-chartered rather than being retroactively rewritten. This
 * mirrors the still-open question in PRD-admin-org-separation.md about
 * whether renames should cascade; until that's settled, "as chartered"
 * is the safer default.
 */
export const PATCH = withAdminAuth(
  async (request: NextRequest, _auth: AuthenticatedRequest, params: Record<string, string>) => {
    const workstreamId = parseIntParam(params.workstream_id, "workstream_id");
    if (workstreamId instanceof NextResponse) return workstreamId;

    const body = await parseBody(request, updateWorkstreamSchema);
    if (isErrorResponse(body)) return body;

    // workstreams is service-role-write-only (migration 00060) — the admin
    // cookie client has no UPDATE policy on this table.
    const client = createServiceClient();

    const { data: workstream, error } = await client
      .from("workstreams")
      .update(body)
      .eq("id", workstreamId)
      .select()
      .single();

    if (error) {
      // .single() surfaces a missing row as PGRST116 rather than a null
      // `data` with no error — map it to a 404 instead of the generic 500
      // dbError() would otherwise produce.
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Workstream not found" }, { status: 404 });
      }
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A workstream with that slug already exists." },
          { status: 409 }
        );
      }
      return dbError(error);
    }
    if (!workstream) {
      return NextResponse.json({ error: "Workstream not found" }, { status: 404 });
    }

    return NextResponse.json(workstream);
  }
);
