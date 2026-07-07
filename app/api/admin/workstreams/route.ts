import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createWorkstreamSchema } from "@/lib/validations/workstreams";
import { slugifyHandle } from "@/lib/participants/handle";
import { createServiceClient } from "@/lib/supabase/server";
import { HQ_SECTOR_SLUG, resolveHqSectorId } from "@/lib/cycle/org-sector";

export const POST = withAdminAuth(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (request: NextRequest, _auth: AuthenticatedRequest) => {
    const body = await parseBody(request, createWorkstreamSchema);
    if (isErrorResponse(body)) return body;
    const { name, description } = body;
    let { slug, sector_id } = body;

    // workstreams is service-role-write-only (migration 00060) — the admin
    // cookie client has no INSERT policy on this table.
    const client = createServiceClient();

    if (!sector_id) {
      const hqSectorId = await resolveHqSectorId(client);
      if (!hqSectorId) {
        return NextResponse.json(
          {
            error: `The seed sector "${HQ_SECTOR_SLUG}" is missing — workstreams require it. Re-run migration 00060.`,
          },
          { status: 500 }
        );
      }
      sector_id = hqSectorId;
    }

    if (!slug) {
      slug = slugifyHandle(name);
    }

    const { data: workstream, error } = await client
      .from("workstreams")
      .insert({ name, slug, description, sector_id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: `A workstream with slug "${slug}" already exists.` },
          { status: 409 }
        );
      }
      return dbError(error);
    }

    return NextResponse.json(workstream, { status: 201 });
  }
);
