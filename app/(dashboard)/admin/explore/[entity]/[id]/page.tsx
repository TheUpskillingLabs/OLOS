// Entity Explorer — detail / 360 view (DESIGN.md §6.1, §7).
//
// Guarded RSC, same admin gate as the list view (the service-role client bypasses
// RLS, so this gate is the only protection — DESIGN.md §8). Fetches the base row
// plus every reverse relation and renders the 360. Read-only.

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import { fetchEntityDetail } from "@/lib/entity-explorer/fetch";
import { getEntityConfig } from "@/lib/entity-explorer/registry";
import { EnvBanner } from "../../env-banner";
import { EntityDetail } from "../../entity-detail";

export default async function ExploreDetailPage({
  params,
}: {
  params: Promise<{ entity: string; id: string }>;
}) {
  const { entity: entityParam, id: idParam } = await params;

  // ── Auth: admin only (sole guard over service-role reads). ──
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles)) redirect("/cycles");

  // ── Validate entity + id; unknown entity or non-numeric id → 404. ──
  const config = getEntityConfig(entityParam);
  if (!config) notFound();

  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const result = await fetchEntityDetail(serviceClient, config.key, id);
  if (!result.row) notFound();

  return (
    <div>
      <EnvBanner />

      <p className="mb-4 text-sm text-cloud/60">
        <Link
          href={`/admin/explore?entity=${config.key}`}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-aqua"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {config.label}
        </Link>
        <span className="mx-1.5 text-cloud/30">/</span>
        <span className="text-cloud/85">#{id}</span>
      </p>

      <EntityDetail result={result} />
    </div>
  );
}
