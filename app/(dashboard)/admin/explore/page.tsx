// Entity Explorer — list view (DESIGN.md §7, §9).
//
// Guarded RSC. Reads ?entity, ?cycle, ?page, ?deleted; checks admin; fetches one
// page via the registry-driven fetch; renders the generic table. The service-role
// client bypasses RLS, so the isAdmin gate below is the ONLY thing protecting
// every row — see DESIGN.md §8. Read-only: no mutation surface anywhere.
//
// NOTE: the ENTITY_EXPLORER_ENABLED flag + nav link land in step 4; until then
// this route is reachable only by typing the URL and only by admins.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import { fetchEntityList } from "@/lib/entity-explorer/fetch";
import { isEntityKey } from "@/lib/entity-explorer/registry";
import type { EntityKey } from "@/lib/entity-explorer/types";
import { EnvBanner } from "./env-banner";
import { EntityPicker, type CycleOption } from "./entity-picker";
import { EntityTable } from "./entity-table";

const DEFAULT_ENTITY: EntityKey = "pods";

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; cycle?: string; page?: string; deleted?: string }>;
}) {
  const sp = await searchParams;

  // ── Auth: admin only. This is the sole guard over service-role reads. ──
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles)) redirect("/cycles");

  // ── Parse params. An explicit but unknown entity 404s (DESIGN.md §9.1). ──
  let entity: EntityKey;
  if (sp.entity == null) entity = DEFAULT_ENTITY;
  else if (isEntityKey(sp.entity)) entity = sp.entity;
  else notFound();

  const cycleNum = sp.cycle != null ? Number(sp.cycle) : NaN;
  const cycleId = Number.isFinite(cycleNum) ? cycleNum : null;
  const page = Math.max(1, Number(sp.page) || 1);
  const includeDeleted = sp.deleted === "1";

  // ── Fetch the cycle list (for the filter) and the page in parallel. ──
  const [{ data: cycles }, result] = await Promise.all([
    serviceClient
      .from("cycles")
      .select("id, name")
      .order("start_date", { ascending: false }),
    fetchEntityList(serviceClient, { entity, cycleId, page, includeDeleted }),
  ]);

  const cycleOptions: CycleOption[] = (cycles ?? []).map((c) => ({
    id: c.id as number,
    name: (c.name as string) ?? `Cycle ${c.id}`,
  }));

  return (
    <div>
      <EnvBanner />

      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-cloud/60 transition-colors duration-150 hover:text-aqua focus-visible:text-aqua focus-visible:outline-none"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          Entity Explorer
        </h1>
        <p className="mt-1 text-sm text-cloud/60">
          Browse raw records by entity. Read-only.
        </p>
      </div>

      <EntityPicker
        entity={entity}
        cycles={cycleOptions}
        cycleId={cycleId}
        includeDeleted={includeDeleted}
      />

      <EntityTable result={result} cycleId={cycleId} includeDeleted={includeDeleted} />
    </div>
  );
}
