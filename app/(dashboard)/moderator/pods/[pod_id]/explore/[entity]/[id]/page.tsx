// Pod data — record detail / 360, pod-scoped.
//
// Same generic renderer as the admin 360, with the pod fence enforced in the
// fetch layer: the base row must belong to the pod (else 404 — a hand-typed
// foreign id shows nothing), relations to entities without a podScope are
// dropped, and the surviving relations are themselves narrowed to the pod. So
// a member's 360 here is "this member in THIS pod", not their whole history.

import { notFound } from "next/navigation";
import { fetchEntityDetail } from "@/lib/entity-explorer/fetch";
import {
  MODERATOR_ENTITY_KEYS,
  getEntityConfig,
} from "@/lib/entity-explorer/registry";
import { Breadcrumbs } from "@/app/(dashboard)/admin/explore/breadcrumbs";
import { EntityDetail } from "@/app/(dashboard)/admin/explore/entity-detail";
import type { LinkContext } from "@/app/(dashboard)/admin/explore/cells";
import { requirePodExplorer } from "../../guard";

export const dynamic = "force-dynamic";

export default async function PodExploreDetailPage({
  params,
}: {
  params: Promise<{ pod_id: string; entity: string; id: string }>;
}) {
  const { pod_id, entity: entityParam, id: idParam } = await params;
  const { podId, pod, serviceClient } = await requirePodExplorer(pod_id);

  // Unknown or non-pod-scoped entity → 404, same rule as the list view.
  const config = getEntityConfig(entityParam);
  if (!config || config.podScope == null) notFound();

  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  // podId fences the base row AND every relation section (fetch.ts).
  const result = await fetchEntityDetail(serviceClient, config.key, id, podId);
  if (!result.row) notFound();

  const basePath = `/moderator/pods/${podId}/explore`;
  const ctx: LinkContext = { basePath, entities: MODERATOR_ENTITY_KEYS };
  const podLabel = pod.name ?? `Pod #${podId}`;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "All pods", href: "/moderator?view=all" },
          { label: podLabel, href: `/moderator/pods/${podId}` },
          { label: "Pod data", href: basePath },
          { label: config.label, href: `${basePath}?entity=${config.key}` },
          { label: `#${id}` },
        ]}
      />

      <EntityDetail result={result} ctx={ctx} />
    </div>
  );
}
