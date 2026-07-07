import { createServiceClient } from "@/lib/supabase/server";
import { one } from "@/lib/supabase/embed";
import type {
  DirectoryData,
  DirectoryPerson,
  DirectoryPod,
  DirectoryProject,
  MemberAvatar,
} from "./types";

/**
 * The directory's single fetch — people, pods, and projects with the
 * enrichments the search rows need (cycle names, member counts, avatar
 * stacks, moderator names).
 *
 * Security: everything reads through the SERVICE client — never a widened
 * participants RLS (the 00044 decision). Only display-allowlist columns are
 * selected; no PII column (email, phone, zip, dcpl_card, notes, google_id)
 * is ever in reach. Internal accounts (is_test / is_staff) are excluded from
 * every path: the people list, both membership joins (counts + avatar
 * stacks), and moderator names — matching the Poderator's visibleMembers().
 */

const PERSON_COLUMNS =
  "id, handle, preferred_name, first_name, last_name, headline, primary_expertise, role_intents, profile_image_url, metro_slug, created_at";

/** Truncate a long text to a row-subtitle snippet. */
function snippet(text: string | null | undefined, max = 140): string | null {
  if (!text) return null;
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

interface AvatarSource {
  id: number;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  profile_image_url: string | null;
}

function toAvatar(p: AvatarSource): MemberAvatar {
  const name =
    p.preferred_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return {
    id: p.id,
    name: name || "A member",
    imageUrl: p.profile_image_url,
    initials:
      `${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`.toUpperCase() ||
      "?",
  };
}

/** One entity's membership rollup: active-member count + first-3 avatars. */
interface MemberRollup {
  count: number;
  avatars: MemberAvatar[];
}

function rollupMemberships(
  rows: { key: number | null; participant: AvatarSource | AvatarSource[] | null }[]
): Map<number, MemberRollup> {
  const byKey = new Map<number, MemberRollup>();
  for (const row of rows) {
    if (row.key == null || !row.participant) continue;
    const participant = Array.isArray(row.participant)
      ? row.participant[0]
      : row.participant;
    if (!participant) continue;
    let entry = byKey.get(row.key);
    if (!entry) {
      entry = { count: 0, avatars: [] };
      byKey.set(row.key, entry);
    }
    entry.count += 1;
    if (entry.avatars.length < 3) entry.avatars.push(toAvatar(participant));
  }
  return byKey;
}

export async function fetchDirectoryData(): Promise<DirectoryData> {
  const service = createServiceClient();

  const AVATAR_JOIN =
    "participants:participant_id!inner(id, preferred_name, first_name, last_name, profile_image_url, is_test, is_staff)";

  const [
    peopleRes,
    metrosRes,
    podsRes,
    projectsRes,
    podMembershipsRes,
    projectMembershipsRes,
    cyclesRes,
    enrollmentsRes,
    moderatorsRes,
  ] = await Promise.all([
    service
      .from("participants")
      .select(PERSON_COLUMNS)
      // Members only — internal (test + staff) accounts are hidden everywhere
      // else in the app (the Poderator's visibleMembers()); match that here.
      .eq("is_test", false)
      .eq("is_staff", false)
      .order("created_at", { ascending: false }),
    service.from("metros").select("slug, name, st"),
    service
      .from("pods")
      .select(
        "id, name, status, cycle_id, created_at, problem_statements(statement_text), cycles(name)"
      )
      .order("created_at", { ascending: false }),
    service
      .from("projects")
      .select(
        "id, name, status, cycle_id, pod_id, created_at, solution_proposals(name, summary), pods(name), cycles(name)"
      )
      .order("created_at", { ascending: false }),
    // !inner so the visibility filter applies as a join predicate — a test
    // account never inflates a count or leaks into an avatar stack.
    service
      .from("pod_memberships")
      .select(`pod_id, ${AVATAR_JOIN}`)
      .is("inactive_at", null)
      .eq("participants.is_test", false)
      .eq("participants.is_staff", false),
    service
      .from("project_memberships")
      .select(`project_id, ${AVATAR_JOIN}`)
      .is("left_at", null)
      .eq("participants.is_test", false)
      .eq("participants.is_staff", false),
    service
      .from("cycles")
      .select("id, name, start_date")
      .order("start_date", { ascending: false }),
    service
      .from("cycle_enrollments")
      .select("participant_id, cycle_id")
      .neq("status", "revoked"),
    service
      .from("moderator_assignments")
      .select(
        "pod_id, participants:participant_id!inner(preferred_name, first_name, last_name, is_test, is_staff)"
      )
      .is("removed_at", null)
      .eq("participants.is_test", false)
      .eq("participants.is_staff", false),
  ]);

  // Surface failed reads instead of silently rendering an empty directory — a
  // 400 (e.g. a drifted/renamed column) otherwise looks exactly like "no
  // results." Logs to the server (Vercel), never to the client.
  for (const [label, res] of [
    ["participants", peopleRes],
    ["metros", metrosRes],
    ["pods", podsRes],
    ["projects", projectsRes],
    ["pod_memberships", podMembershipsRes],
    ["project_memberships", projectMembershipsRes],
    ["cycles", cyclesRes],
    ["cycle_enrollments", enrollmentsRes],
    ["moderator_assignments", moderatorsRes],
  ] as const) {
    if (res.error) {
      console.error(`[directory] ${label} query failed:`, res.error.message);
    }
  }

  const metroBySlug = new Map<string, string>();
  for (const m of metrosRes.data ?? []) {
    metroBySlug.set(m.slug, [m.name, m.st].filter(Boolean).join(", "));
  }

  const cycleIdsByParticipant = new Map<number, number[]>();
  for (const e of enrollmentsRes.data ?? []) {
    const list = cycleIdsByParticipant.get(e.participant_id) ?? [];
    list.push(e.cycle_id);
    cycleIdsByParticipant.set(e.participant_id, list);
  }

  const people: DirectoryPerson[] = (peopleRes.data ?? []).map((m) => ({
    id: m.id,
    handle: m.handle,
    displayName:
      m.preferred_name || `${m.first_name} ${m.last_name}`.trim() || "A member",
    firstInitial: m.first_name?.[0] ?? "",
    lastInitial: m.last_name?.[0] ?? "",
    headline: m.headline ?? null,
    primary_expertise: m.primary_expertise ?? null,
    role_intents: m.role_intents ?? [],
    profile_image_url: m.profile_image_url ?? null,
    metroSlug: m.metro_slug ?? null,
    metroName: m.metro_slug ? (metroBySlug.get(m.metro_slug) ?? null) : null,
    cycleIds: cycleIdsByParticipant.get(m.id) ?? [],
    createdAt: m.created_at,
  }));

  const podRollups = rollupMemberships(
    (podMembershipsRes.data ?? []).map((r) => ({
      key: r.pod_id,
      participant: r.participants as AvatarSource | AvatarSource[] | null,
    }))
  );
  const projectRollups = rollupMemberships(
    (projectMembershipsRes.data ?? []).map((r) => ({
      key: r.project_id,
      participant: r.participants as AvatarSource | AvatarSource[] | null,
    }))
  );

  type NameSource = Pick<AvatarSource, "preferred_name" | "first_name" | "last_name">;
  const moderatorNamesByPod = new Map<number, string[]>();
  for (const row of moderatorsRes.data ?? []) {
    const p = one(row.participants as unknown as NameSource | NameSource[] | null);
    if (!p || row.pod_id == null) continue;
    const name =
      p.preferred_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
    if (!name) continue;
    const list = moderatorNamesByPod.get(row.pod_id) ?? [];
    list.push(name);
    moderatorNamesByPod.set(row.pod_id, list);
  }

  const pods: DirectoryPod[] = (podsRes.data ?? []).map((p) => {
    const statement = one(
      p.problem_statements as { statement_text: string | null } | { statement_text: string | null }[] | null
    );
    const cycle = one(p.cycles as { name: string | null } | { name: string | null }[] | null);
    const rollup = podRollups.get(p.id);
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      cycleId: p.cycle_id,
      cycleName: cycle?.name ?? null,
      statement: snippet(statement?.statement_text),
      moderatorNames: moderatorNamesByPod.get(p.id) ?? [],
      memberCount: rollup?.count ?? 0,
      avatars: rollup?.avatars ?? [],
      createdAt: p.created_at,
    };
  });

  const projects: DirectoryProject[] = (projectsRes.data ?? []).map((p) => {
    const proposal = one(
      p.solution_proposals as { name: string | null; summary: string | null } | { name: string | null; summary: string | null }[] | null
    );
    const pod = one(p.pods as { name: string | null } | { name: string | null }[] | null);
    const cycle = one(p.cycles as { name: string | null } | { name: string | null }[] | null);
    const rollup = projectRollups.get(p.id);
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      cycleId: p.cycle_id,
      cycleName: cycle?.name ?? null,
      podId: p.pod_id,
      podName: pod?.name ?? null,
      summary: proposal?.name ?? snippet(proposal?.summary, 100),
      memberCount: rollup?.count ?? 0,
      avatars: rollup?.avatars ?? [],
      createdAt: p.created_at,
    };
  });

  // Filter options: only metros that appear on a visible member.
  const memberMetroSlugs = new Set(
    people.map((p) => p.metroSlug).filter((s): s is string => !!s)
  );
  const metros = [...memberMetroSlugs]
    .map((slug) => ({ slug, label: metroBySlug.get(slug) ?? slug }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const cycles = (cyclesRes.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  return { people, pods, projects, filterOptions: { metros, cycles } };
}
