import { NextResponse, NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { requireLabAccess } from "@/lib/auth/lab";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createWorkstreamSchema } from "@/lib/validations/workstreams";
import { slugifyHandle } from "@/lib/participants/handle";
import { createServiceClient } from "@/lib/supabase/server";
import { HQ_SECTOR_SLUG, resolveHqSectorId } from "@/lib/cycle/org-sector";

export const POST = withAuth(
  async (request: NextRequest, auth: AuthenticatedRequest) => {
    const body = await parseBody(request, createWorkstreamSchema);
    if (isErrorResponse(body)) return body;
    const { name, description, lab_id } = body;
    let { slug, sector_id } = body;

    // Local Labs (docs/LOCAL_LABS.md): a workstream lives in exactly one
    // home. With lab_id it's a lab's internal workstream — admin or that
    // lab's lead may create it. Without lab_id it's HQ's sector-homed
    // track — requireLabAccess(user, null) keeps that admin-only.
    const guard = requireLabAccess(auth.user, lab_id ?? null);
    if (guard) return guard;
    if (lab_id && sector_id) {
      return NextResponse.json(
        { error: "A workstream belongs to either a sector or a lab, not both." },
        { status: 400 }
      );
    }

    // workstreams is service-role-write-only (migration 00060) — the admin
    // cookie client has no INSERT policy on this table.
    const client = createServiceClient();

    if (lab_id) {
      const { data: metro } = await client
        .from("metros")
        .select("id")
        .eq("id", lab_id)
        .maybeSingle();
      if (!metro) {
        return NextResponse.json(
          { error: `No local lab (metro) with id ${lab_id}.` },
          { status: 404 }
        );
      }
    } else if (!sector_id) {
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

    const insert: Record<string, unknown> = { name, slug, description };
    if (lab_id) insert.lab_id = lab_id;
    else insert.sector_id = sector_id;

    const { data: workstream, error } = await client
      .from("workstreams")
      .insert(insert)
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
