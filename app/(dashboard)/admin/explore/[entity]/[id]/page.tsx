// Entity Explorer — detail / 360 view (DESIGN.md §6.1, §7).
//
// Guarded RSC, same admin gate as the list view (the service-role client bypasses
// RLS, so this gate is the only protection — DESIGN.md §8). Fetches the base row
// plus every reverse relation and renders the 360. Read-only.

import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { fetchEntityDetail } from "@/lib/entity-explorer/fetch";
import { getEntityConfig } from "@/lib/entity-explorer/registry";
import { ENTITY_EXPLORER_ENABLED } from "@/lib/entity-explorer/flag";
import { Breadcrumbs } from "../../breadcrumbs";
import { EntityDetail } from "../../entity-detail";

export default async function ExploreDetailPage({
  params,
}: {
  params: Promise<{ entity: string; id: string }>;
}) {
  // Feature flag (DESIGN.md §4): off → the route doesn't exist.
  if (!ENTITY_EXPLORER_ENABLED) notFound();

  const { entity: entityParam, id: idParam } = await params;

  // ── Auth: admin only (sole guard over service-role reads). ──
  const { serviceClient } = await requireAdmin();

  // ── Validate entity + id; unknown entity or non-numeric id → 404. ──
  const config = getEntityConfig(entityParam);
  if (!config) notFound();

  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const result = await fetchEntityDetail(serviceClient, config.key, id);
  if (!result.row) notFound();

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Entity Explorer", href: "/admin/explore" },
          { label: config.label, href: `/admin/explore?entity=${config.key}` },
          { label: `#${id}` },
        ]}
      />

      <EntityDetail result={result} />
    </div>
  );
}
