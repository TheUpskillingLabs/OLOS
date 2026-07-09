import { createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";

/**
 * Read models for the public sector & workstream detail pages — the deep-link
 * targets for the dashboard left-rail "org unit" row. Service-client reads
 * (both tables are public-SELECT RLS anyway); one aggregator per page, modeled
 * on lib/content/queries.ts / lib/directory/data.ts.
 */

export interface SectorPageData {
  sector: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
  };
  cycles: {
    id: number;
    name: string;
    status: string;
    mode: string;
    start_date: string;
    end_date: string;
  }[];
  workstreams: { id: number; name: string; slug: string; status: string }[];
}

export async function getSectorPage(
  slug: string
): Promise<SectorPageData | null> {
  const service = createServiceClient();
  const { data: sector } = await service
    .from("sectors")
    .select("id, name, slug, description, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!sector) return null;

  const [{ data: cycles }, { data: workstreams }] = await Promise.all([
    service
      .from("cycles")
      .select("id, name, status, mode, start_date, end_date")
      .eq("sector_id", sector.id)
      .order("start_date", { ascending: false }),
    service
      .from("workstreams")
      .select("id, name, slug, status")
      .eq("sector_id", sector.id)
      .order("name"),
  ]);

  return {
    sector,
    cycles: cycles ?? [],
    workstreams: workstreams ?? [],
  };
}

export interface WorkstreamPageData {
  workstream: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    status: string;
  };
  /** Where the workstream is homed — its sector (HQ) or its lab. */
  home: { kind: "sector" | "lab"; name: string; href: string } | null;
  /** Per-cycle runs (a run is a pods row carrying workstream_id). */
  runs: {
    podId: number;
    name: string | null;
    status: string;
    cycleName: string | null;
  }[];
}

export async function getWorkstreamPage(
  slug: string
): Promise<WorkstreamPageData | null> {
  const service = createServiceClient();
  const { data: ws } = await service
    .from("workstreams")
    .select("id, name, slug, description, status, sector_id, lab_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!ws) return null;

  // Home: a workstream lives under exactly one of a lab XOR a sector (00062).
  let home: WorkstreamPageData["home"] = null;
  if (ws.lab_id != null) {
    const { data: lab } = await service
      .from("metros")
      .select("name, slug")
      .eq("id", ws.lab_id)
      .maybeSingle();
    if (lab) home = { kind: "lab", name: lab.name, href: `/local-labs/${lab.slug}` };
  } else if (ws.sector_id != null) {
    const { data: sector } = await service
      .from("sectors")
      .select("name, slug")
      .eq("id", ws.sector_id)
      .maybeSingle();
    if (sector)
      home = { kind: "sector", name: sector.name, href: `/sectors/${sector.slug}` };
  }

  const { data: pods } = await service
    .from("pods")
    .select("id, name, status, cycles(name)")
    .eq("workstream_id", ws.id)
    .order("id", { ascending: false });
  const runs = (pods ?? []).map((p) => ({
    podId: p.id,
    name: p.name,
    status: p.status,
    cycleName:
      one(p.cycles as { name: string | null } | { name: string | null }[] | null)
        ?.name ?? null,
  }));

  return {
    workstream: {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      description: ws.description,
      status: ws.status,
    },
    home,
    runs,
  };
}
