// Pod data — the poderator's slice of the Entity Explorer (list view).
//
// The same registry-driven, read-only grid as /admin/explore, narrowed two
// ways: only entities with a declared podScope appear (registry.ts
// MODERATOR_ENTITY_KEYS), and every fetch carries a forced podId so a row from
// another pod can never render. No cycle filter — a pod lives in one cycle.
// UI copy never says "moderator" (docs/poderator-dashboard/CLAUDE.md).

import { notFound } from "next/navigation";
import { fetchEntityList } from "@/lib/entity-explorer/fetch";
import {
  MODERATOR_ENTITY_KEYS,
  isModeratorEntityKey,
} from "@/lib/entity-explorer/registry";
import type { EntityKey } from "@/lib/entity-explorer/types";
import { ContactsDownloadButton } from "@/app/components/contacts-download-button";
import { Breadcrumbs } from "@/app/(dashboard)/admin/explore/breadcrumbs";
import {
  EntityPicker,
  type EntityGroup,
} from "@/app/(dashboard)/admin/explore/entity-picker";
import { EntityTable } from "@/app/(dashboard)/admin/explore/entity-table";
import type { LinkContext } from "@/app/(dashboard)/admin/explore/cells";
import { requirePodExplorer } from "./guard";

export const dynamic = "force-dynamic";

const DEFAULT_ENTITY: EntityKey = "pod_memberships";

/** The pod surface's dropdown — every key here MUST carry a podScope. */
const POD_GROUPS: EntityGroup[] = [
  { label: "Pod", keys: ["pods", "pod_memberships", "moderator_assignments", "participants"] },
  { label: "Projects", keys: ["solution_proposals", "projects", "project_votes", "project_memberships"] },
  { label: "Engagement", keys: ["pulse_checks"] },
];

export default async function PodExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ pod_id: string }>;
  searchParams: Promise<{
    entity?: string;
    page?: string;
    deleted?: string;
    q?: string;
    fcol?: string;
    fval?: string;
  }>;
}) {
  const { pod_id } = await params;
  const { podId, pod, serviceClient } = await requirePodExplorer(pod_id);

  const sp = await searchParams;

  // An explicit but non-pod-scoped entity (e.g. ?entity=cycles) 404s — the
  // admin registry is NOT reachable from here by typing the URL.
  let entity: EntityKey;
  if (sp.entity == null) entity = DEFAULT_ENTITY;
  else if (isModeratorEntityKey(sp.entity)) entity = sp.entity;
  else notFound();

  const page = Math.max(1, Number(sp.page) || 1);
  const includeDeleted = sp.deleted === "1";
  const search = sp.q ?? null;
  const filterColumn = sp.fcol ?? null;
  const filterValue = sp.fval ?? null;

  const result = await fetchEntityList(serviceClient, {
    entity,
    podId, // forced — never URL-driven
    page,
    includeDeleted,
    search,
    filterColumn,
    filterValue,
  });

  const basePath = `/moderator/pods/${podId}/explore`;
  const ctx: LinkContext = { basePath, entities: MODERATOR_ENTITY_KEYS };

  const csvParams = new URLSearchParams({ entity });
  if (includeDeleted) csvParams.set("deleted", "1");
  if (search) csvParams.set("q", search);
  if (filterColumn) csvParams.set("fcol", filterColumn);
  if (filterValue) csvParams.set("fval", filterValue);
  const csvHref = `/api/moderator/pods/${podId}/explore/export?${csvParams.toString()}`;

  const podLabel = pod.name ?? `Pod #${podId}`;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "All pods", href: "/moderator?view=all" },
          { label: podLabel, href: `/moderator/pods/${podId}` },
          { label: "Pod data" },
        ]}
      />

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="t-h1 text-ink">Pod data</h1>
          <p className="mt-1 text-sm text-slate">
            Browse {podLabel}&rsquo;s raw records by entity. Read-only.
          </p>
        </div>
        <ContactsDownloadButton href={csvHref} label="Download CSV" />
      </div>

      <EntityPicker
        entity={entity}
        cycles={null}
        cycleId={null}
        includeDeleted={includeDeleted}
        basePath={basePath}
        groups={POD_GROUPS}
      />

      <EntityTable
        result={result}
        cycleId={null}
        includeDeleted={includeDeleted}
        search={search}
        filterColumn={filterColumn}
        filterValue={filterValue}
        ctx={ctx}
      />
    </div>
  );
}
