import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdmin,
  isLabLead,
  isModeratorForPod,
  type UserRoles,
} from "@/lib/auth/roles";
import { isProjectMember } from "@/lib/auth/projects";

/**
 * Page authorization — who can post as / manage a "page" (a local lab, sector,
 * workstream, pod, or project). Every page has an admin set:
 *   • site admins/owners (any page),
 *   • the entity's AUTO-admins (its leads — for a project, all members/maintainers),
 *   • anyone explicitly added to `page_admins` (00076).
 * A page admin may post updates as the page and manage its admin list.
 */

export type PageType = "lab" | "sector" | "workstream" | "pod" | "project";

export const PAGE_TYPES: PageType[] = [
  "lab",
  "sector",
  "workstream",
  "pod",
  "project",
];

export interface PageRef {
  type: PageType;
  id: number;
  name: string;
  href: string;
}

const TYPE_LABEL: Record<PageType, string> = {
  lab: "Local Lab",
  sector: "Sector",
  workstream: "Workstream",
  pod: "Pod",
  project: "Project",
};

export function pageTypeLabel(type: PageType): string {
  return TYPE_LABEL[type];
}

/** Canonical link to a page. Labs/sectors/workstreams use slug; pods/projects id. */
export function pageHref(type: PageType, idOrSlug: string | number): string {
  switch (type) {
    case "lab":
      return `/local-labs/${idOrSlug}`;
    case "sector":
      return `/sectors/${idOrSlug}`;
    case "workstream":
      return `/workstreams/${idOrSlug}`;
    case "pod":
      return `/pods/${idOrSlug}`;
    case "project":
      return `/projects/${idOrSlug}`;
  }
}

/** The distinct workstream ids a participant co-leads (run co-lead → workstream). */
async function workstreamsLedBy(
  service: SupabaseClient,
  user: UserRoles
): Promise<number[]> {
  if (user.moderatorPodIds.length === 0) return [];
  const { data: runPods } = await service
    .from("pods")
    .select("workstream_id")
    .in("id", user.moderatorPodIds)
    .not("workstream_id", "is", null);
  return [
    ...new Set((runPods ?? []).map((p) => p.workstream_id as number)),
  ];
}

/** Whether this participant has been explicitly added as an admin of the page. */
async function hasExplicitAdmin(
  service: SupabaseClient,
  participantId: number,
  type: PageType,
  id: number
): Promise<boolean> {
  const { count } = await service
    .from("page_admins")
    .select("id", { head: true, count: "exact" })
    .eq("page_type", type)
    .eq("page_id", id)
    .eq("participant_id", participantId)
    .is("removed_at", null);
  return (count ?? 0) > 0;
}

/**
 * The authoritative gate: may `user` post as / manage the given page?
 * Site admin OR the page's auto-admins OR an explicit page_admins row.
 */
export async function isPageAdmin(
  service: SupabaseClient,
  user: UserRoles,
  type: PageType,
  id: number
): Promise<boolean> {
  if (isAdmin(user)) return true;

  // Auto-admins by entity leadership/membership.
  switch (type) {
    case "lab":
      if (isLabLead(user, id)) return true;
      break;
    case "pod":
      if (isModeratorForPod(user, id)) return true;
      break;
    case "workstream": {
      const led = await workstreamsLedBy(service, user);
      if (led.includes(id)) return true;
      break;
    }
    case "project": {
      const { data: proj } = await service
        .from("projects")
        .select("pod_id")
        .eq("id", id)
        .maybeSingle();
      if (proj && (await isProjectMember(service, user, id, proj.pod_id))) {
        return true;
      }
      break;
    }
    case "sector":
      // No sector-lead role — admin or explicit only.
      break;
  }

  if (user.participantId == null) return false;
  return hasExplicitAdmin(service, user.participantId, type, id);
}

/**
 * The pages this user can post as (their personal "Post as" list): every page
 * where they're an auto-admin, plus any page they've been explicitly added to.
 * A pure site admin who leads nothing posts from a specific page's own composer,
 * so this list stays scoped to real affiliations.
 */
export async function pagesUserCanPostAs(
  service: SupabaseClient,
  user: UserRoles
): Promise<PageRef[]> {
  if (user.participantId == null) return [];
  const refs: PageRef[] = [];
  const seen = new Set<string>();
  const push = (type: PageType, id: number, name: string, href: string) => {
    const key = `${type}:${id}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ type, id, name, href });
    }
  };

  // Labs led.
  if (user.labLeadLabIds.length > 0) {
    const { data } = await service
      .from("metros")
      .select("id, name, slug")
      .in("id", user.labLeadLabIds);
    for (const m of data ?? [])
      push("lab", m.id, m.name, pageHref("lab", m.slug));
  }

  // Pods moderated.
  if (user.moderatorPodIds.length > 0) {
    const { data } = await service
      .from("pods")
      .select("id, name")
      .in("id", user.moderatorPodIds);
    for (const p of data ?? [])
      push("pod", p.id, p.name ?? `Pod ${p.id}`, pageHref("pod", p.id));
  }

  // Workstreams led (via run co-lead).
  const wsIds = await workstreamsLedBy(service, user);
  if (wsIds.length > 0) {
    const { data } = await service
      .from("workstreams")
      .select("id, name, slug")
      .in("id", wsIds);
    for (const w of data ?? [])
      push("workstream", w.id, w.name, pageHref("workstream", w.slug));
  }

  // Projects the user is a member/maintainer of (active project_roles).
  const { data: projRoles } = await service
    .from("project_roles")
    .select("project_id")
    .eq("participant_id", user.participantId)
    .is("removed_at", null);
  const projIds = [
    ...new Set((projRoles ?? []).map((r) => r.project_id as number)),
  ];
  if (projIds.length > 0) {
    const { data } = await service
      .from("projects")
      .select("id, name")
      .in("id", projIds);
    for (const p of data ?? [])
      push(
        "project",
        p.id,
        p.name ?? `Project ${p.id}`,
        pageHref("project", p.id)
      );
  }

  // Explicit page-admin rows (any type, incl. sectors + pages you don't lead).
  const { data: explicit } = await service
    .from("page_admins")
    .select("page_type, page_id")
    .eq("participant_id", user.participantId)
    .is("removed_at", null);
  await resolveExplicitRefs(service, explicit ?? [], push);

  return refs;
}

/** Resolve names/links for explicit page_admins rows, grouped by type. */
async function resolveExplicitRefs(
  service: SupabaseClient,
  rows: { page_type: string; page_id: number }[],
  push: (type: PageType, id: number, name: string, href: string) => void
): Promise<void> {
  const byType = new Map<PageType, number[]>();
  for (const r of rows) {
    const t = r.page_type as PageType;
    byType.set(t, [...(byType.get(t) ?? []), r.page_id]);
  }
  for (const [type, ids] of byType) {
    const named = await pageNames(service, type, ids);
    for (const id of ids) {
      const n = named.get(id);
      if (n) push(type, id, n.name, n.href);
    }
  }
}

/** Batch-resolve display name + href for a set of page ids of one type. */
export async function pageNames(
  service: SupabaseClient,
  type: PageType,
  ids: number[]
): Promise<Map<number, { name: string; href: string }>> {
  const out = new Map<number, { name: string; href: string }>();
  if (ids.length === 0) return out;
  const uniq = [...new Set(ids)];

  if (type === "lab" || type === "sector" || type === "workstream") {
    const table =
      type === "lab" ? "metros" : type === "sector" ? "sectors" : "workstreams";
    const { data } = await service
      .from(table)
      .select("id, name, slug")
      .in("id", uniq);
    for (const r of data ?? [])
      out.set(r.id, { name: r.name, href: pageHref(type, r.slug) });
    return out;
  }

  // pods / projects — no slug, addressed by id, name may be null.
  const table = type === "pod" ? "pods" : "projects";
  const fallback = type === "pod" ? "Pod" : "Project";
  const { data } = await service.from(table).select("id, name").in("id", uniq);
  for (const r of data ?? [])
    out.set(r.id, {
      name: r.name ?? `${fallback} ${r.id}`,
      href: pageHref(type, r.id),
    });
  return out;
}

export interface PageAdminEntry {
  participantId: number;
  name: string;
  handle: string | null;
  /** "added" rows are removable; auto-admins ("lead"/"member") come from roles. */
  source: "lead" | "member" | "added";
}

const ADMIN_DISPLAY =
  "participant_id, participants:participant_id!inner(handle, preferred_name, first_name, last_name)";

interface AdminRow {
  participant_id: number;
  participants:
    | { handle: string | null; preferred_name: string | null; first_name: string | null; last_name: string | null }
    | { handle: string | null; preferred_name: string | null; first_name: string | null; last_name: string | null }[]
    | null;
}

function adminEntry(row: AdminRow, source: PageAdminEntry["source"]): PageAdminEntry {
  const p = Array.isArray(row.participants)
    ? row.participants[0]
    : row.participants;
  const name =
    p?.preferred_name ||
    [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
    "A member";
  return {
    participantId: row.participant_id,
    name,
    handle: p?.handle ?? null,
    source,
  };
}

/** Merge rosters, deduping by participant with the strongest source winning
    (lead > member > added) — pure, unit-tested. */
export function mergeAdminRosters(
  ...rosters: PageAdminEntry[][]
): PageAdminEntry[] {
  const rank: Record<PageAdminEntry["source"], number> = {
    lead: 0,
    member: 1,
    added: 2,
  };
  const byId = new Map<number, PageAdminEntry>();
  for (const roster of rosters) {
    for (const entry of roster) {
      const existing = byId.get(entry.participantId);
      if (!existing || rank[entry.source] < rank[existing.source]) {
        byId.set(entry.participantId, entry);
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => rank[a.source] - rank[b.source] || a.name.localeCompare(b.name)
  );
}

/**
 * The FULL admin roster for the manage panel: the page's auto-admins (its
 * leads; a project's members/maintainers) labelled by source, merged with the
 * explicitly-added `page_admins` rows. Only "added" rows are removable — the
 * rest derive from roles. Display-safe fields via a participants allowlist join.
 */
export async function pageAdmins(
  service: SupabaseClient,
  type: PageType,
  id: number
): Promise<PageAdminEntry[]> {
  // Explicit rows.
  const { data: explicit } = await service
    .from("page_admins")
    .select(ADMIN_DISPLAY)
    .eq("page_type", type)
    .eq("page_id", id)
    .is("removed_at", null)
    .order("created_at", { ascending: true });
  const added = ((explicit ?? []) as unknown as AdminRow[]).map((r) =>
    adminEntry(r, "added")
  );

  // Auto-admins by entity type.
  const auto: PageAdminEntry[] = [];
  if (type === "lab") {
    const { data } = await service
      .from("participant_roles")
      .select(ADMIN_DISPLAY)
      .eq("role", "lab_lead")
      .eq("lab_id", id)
      .is("revoked_at", null);
    auto.push(
      ...((data ?? []) as unknown as AdminRow[]).map((r) => adminEntry(r, "lead"))
    );
  } else if (type === "pod") {
    const { data } = await service
      .from("moderator_assignments")
      .select(ADMIN_DISPLAY)
      .eq("pod_id", id)
      .is("removed_at", null);
    auto.push(
      ...((data ?? []) as unknown as AdminRow[]).map((r) => adminEntry(r, "lead"))
    );
  } else if (type === "workstream") {
    const { data: runPods } = await service
      .from("pods")
      .select("id")
      .eq("workstream_id", id);
    const podIds = (runPods ?? []).map((p) => p.id as number);
    if (podIds.length > 0) {
      const { data } = await service
        .from("moderator_assignments")
        .select(ADMIN_DISPLAY)
        .in("pod_id", podIds)
        .is("removed_at", null);
      auto.push(
        ...((data ?? []) as unknown as AdminRow[]).map((r) =>
          adminEntry(r, "lead")
        )
      );
    }
  } else if (type === "project") {
    const { data: proj } = await service
      .from("projects")
      .select("pod_id")
      .eq("id", id)
      .maybeSingle();
    const [{ data: roleRows }, coLeads] = await Promise.all([
      service
        .from("project_roles")
        .select(ADMIN_DISPLAY)
        .eq("project_id", id)
        .is("removed_at", null),
      proj
        ? service
            .from("moderator_assignments")
            .select(ADMIN_DISPLAY)
            .eq("pod_id", proj.pod_id)
            .is("removed_at", null)
        : Promise.resolve({ data: [] as AdminRow[] }),
    ]);
    auto.push(
      ...((coLeads.data ?? []) as unknown as AdminRow[]).map((r) =>
        adminEntry(r, "lead")
      ),
      ...((roleRows ?? []) as unknown as AdminRow[]).map((r) =>
        adminEntry(r, "member")
      )
    );
  }
  // Sectors: no lead role — admin/explicit only.

  return mergeAdminRosters(auto, added);
}
