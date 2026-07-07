import { NextResponse, NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/auth/middleware";
import type { AuthenticatedRequest } from "@/lib/auth/middleware";
import { dbError } from "@/lib/api/errors";
import { parseBody, isErrorResponse } from "@/lib/api/request";
import { createWorkstreamSchema } from "@/lib/validations/workstreams";
import { slugifyHandle } from "@/lib/participants/handle";
import { createServiceClient } from "@/lib/supabase/server";

const HQ_SECTOR_SLUG = "the-upskilling-labs-hq";

interface RunRow {
  id: number;
  cycle_id: number;
  status: string;
  workstream_id: number;
}

export const GET = withAdminAuth(
  async (_request: NextRequest, auth: AuthenticatedRequest) => {
    const { data: workstreams, error } = await auth.supabase
      .from("workstreams")
      .select("id, sector_id, name, slug, description, status, created_at, updated_at")
      .order("name");
    if (error) {
      return dbError(error);
    }

    const workstreamIds = (workstreams ?? []).map((w) => w.id);

    // Runs are ordinary pods rows (docs/ORG_CYCLES.md §2) — a second query
    // rather than an embed, keeping the shape explicit.
    const runsByWorkstream = new Map<number, { id: number; cycle_id: number; status: string }[]>();
    if (workstreamIds.length > 0) {
      const { data: runs, error: runsError } = await auth.supabase
        .from("pods")
        .select("id, cycle_id, status, workstream_id")
        .in("workstream_id", workstreamIds);
      if (runsError) {
        return dbError(runsError);
      }
      for (const run of (runs ?? []) as RunRow[]) {
        const list = runsByWorkstream.get(run.workstream_id) ?? [];
        list.push({ id: run.id, cycle_id: run.cycle_id, status: run.status });
        runsByWorkstream.set(run.workstream_id, list);
      }
    }

    const result = (workstreams ?? []).map((w) => ({
      ...w,
      runs: runsByWorkstream.get(w.id) ?? [],
    }));

    return NextResponse.json(result);
  }
);

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
      const { data: hqSector } = await client
        .from("sectors")
        .select("id")
        .eq("slug", HQ_SECTOR_SLUG)
        .maybeSingle();
      if (!hqSector) {
        return NextResponse.json(
          {
            error: `The seed sector "${HQ_SECTOR_SLUG}" is missing — workstreams require it. Re-run migration 00060.`,
          },
          { status: 500 }
        );
      }
      sector_id = hqSector.id;
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
