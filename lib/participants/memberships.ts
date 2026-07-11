import { createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";

/**
 * The left-rail "pages/groups" aggregator — the LinkedIn-style list of the
 * entities a participant belongs to: org unit (sector, or workstream for org
 * members), local lab, cycle, pod(s), project(s).
 *
 * One service-client fan-out modeled on lib/directory/data.ts: display columns
 * only, log-on-error, active rows only (soft-delete filters mirror the existing
 * dashboard/directory queries — `inactive_at`/`left_at` IS NULL). Cycle comes
 * from the caller's already-resolved `activeCycle` to avoid a redundant query.
 */

export type MembershipKind = "orgUnit" | "lab" | "cycle" | "pod" | "project";

export interface MembershipEntity {
  kind: MembershipKind;
  id: number;
  name: string;
  /** A route to deep-link to, or null to render as a plain label/chip. */
  href: string | null;
  /** Secondary line (dates, etc.). */
  sublabel?: string | null;
  /** Lifecycle status, when the row has one (pods/projects). */
  status?: string | null;
}

export interface ParticipantMemberships {
  orgUnit: MembershipEntity | null;
  lab: MembershipEntity | null;
  cycles: MembershipEntity[];
  pods: MembershipEntity[];
  projects: MembershipEntity[];
}

export interface MembershipsContext {
  /** participants.metro_id — the active local lab, or null. */
  metroId: number | null;
  /** The member's current cohort (already resolved on the dashboard). */
  activeCycle: {
    id: number;
    name: string;
    start_date: string | null;
    end_date: string | null;
    sector_id: number | null;
    mode: string | null;
  } | null;
}

/** "Baltimore, MD" — lab name with its state suffix when present. */
export function labDisplayName(name: string, st: string | null): string {
  return [name, st].filter(Boolean).join(", ");
}

/** A "Mar 2026 – Jun 2026" range for a cycle sublabel; null when no dates. */
export function cycleDateRange(
  start: string | null,
  end: string | null
): string | null {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start || end) return fmt((start ?? end) as string);
  return null;
}

/** Does the member belong to anything at all? Drives the panel's empty state. */
export function hasAnyMembership(m: ParticipantMemberships): boolean {
  return Boolean(
    m.orgUnit || m.lab || m.cycles.length || m.pods.length || m.projects.length
  );
}

interface PodJoin {
  id: number;
  pod_id: number;
  pods:
    | {
        id: number;
        name: string;
        status: string;
        workstream_id: number | null;
      }
    | { id: number; name: string; status: string; workstream_id: number | null }[]
    | null;
}

interface ProjectJoin {
  id: number;
  project_id: number;
  projects:
    | { id: number; name: string; status: string }
    | { id: number; name: string; status: string }[]
    | null;
}

export async function getParticipantMemberships(
  participantId: number,
  ctx: MembershipsContext
): Promise<ParticipantMemberships> {
  const service = createServiceClient();
  const { metroId, activeCycle } = ctx;

  const [labRes, podsRes, projectsRes, sectorRes] = await Promise.all([
    metroId != null
      ? service
          .from("metros")
          .select("id, slug, name, st")
          .eq("id", metroId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    service
      .from("pod_memberships")
      .select("id, pod_id, pods!inner(id, name, status, workstream_id)")
      .eq("participant_id", participantId)
      .is("inactive_at", null),
    service
      .from("project_memberships")
      .select("id, project_id, projects!inner(id, name, status)")
      .eq("participant_id", participantId)
      .is("left_at", null),
    // Org unit for a participant (open) cycle = the cycle's sector.
    activeCycle?.sector_id != null && activeCycle.mode !== "org"
      ? service
          .from("sectors")
          .select("id, name, slug")
          .eq("id", activeCycle.sector_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  for (const [label, res] of [
    ["metros", labRes],
    ["pod_memberships", podsRes],
    ["project_memberships", projectsRes],
    ["sectors", sectorRes],
  ] as const) {
    if (res && "error" in res && res.error) {
      console.error(`[memberships] ${label} query failed:`, res.error.message);
    }
  }

  // ── lab ──
  const labRow = labRes.data as {
    id: number;
    slug: string;
    name: string;
    st: string | null;
  } | null;
  const lab: MembershipEntity | null = labRow
    ? {
        kind: "lab",
        id: labRow.id,
        name: labDisplayName(labRow.name, labRow.st),
        href: `/local-labs/${labRow.slug}`,
      }
    : null;

  // ── cycles (the member's current cohort) ──
  const cycles: MembershipEntity[] = activeCycle
    ? [
        {
          kind: "cycle",
          id: activeCycle.id,
          name: activeCycle.name,
          // The running cycle's canonical page is the My Cycle hub — its
          // /cycles/[id] detail route redirects there anyway.
          href: "/cycles",
          sublabel: cycleDateRange(activeCycle.start_date, activeCycle.end_date),
        },
      ]
    : [];

  // ── pods ──
  const podRows = (podsRes.data as unknown as PodJoin[]) ?? [];
  const pods: MembershipEntity[] = podRows.flatMap((m) => {
    const pod = one(m.pods);
    if (!pod) return [];
    return [
      {
        kind: "pod" as const,
        id: pod.id,
        name: pod.name,
        href: `/pods/${pod.id}`,
        status: pod.status,
      },
    ];
  });

  // ── projects ──
  const projectRows = (projectsRes.data as unknown as ProjectJoin[]) ?? [];
  const projects: MembershipEntity[] = projectRows.flatMap((m) => {
    const project = one(m.projects);
    if (!project) return [];
    return [
      {
        kind: "project" as const,
        id: project.id,
        name: project.name,
        href: `/projects/${project.id}`,
        status: project.status,
      },
    ];
  });

  // ── org unit ──
  // Participant (open) cycles: the cycle's sector → /sectors/[slug]. Org
  // members: the workstream behind one of their run pods → /workstreams/[slug].
  // The sector query already ran above; the workstream fallback only fires for
  // org members (a pod carrying a workstream_id), so it stays off the hot path.
  let orgUnit: MembershipEntity | null = null;
  const sectorRow = sectorRes.data as {
    id: number;
    name: string;
    slug: string;
  } | null;
  if (sectorRow) {
    orgUnit = {
      kind: "orgUnit",
      id: sectorRow.id,
      name: sectorRow.name,
      href: `/sectors/${sectorRow.slug}`,
    };
  } else {
    const runPod = podRows
      .map((m) => one(m.pods))
      .find((p) => p?.workstream_id != null);
    if (runPod?.workstream_id != null) {
      const { data: ws } = await service
        .from("workstreams")
        .select("id, name, slug")
        .eq("id", runPod.workstream_id)
        .maybeSingle();
      if (ws) {
        orgUnit = {
          kind: "orgUnit",
          id: ws.id,
          name: ws.name,
          href: `/workstreams/${ws.slug}`,
        };
      }
    }
  }

  return { orgUnit, lab, cycles, pods, projects };
}
