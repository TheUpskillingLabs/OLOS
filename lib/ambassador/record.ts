/* The applicant's OLOS record, as the ambassador reviewers see it beside the
   application (/ambassador/coordinator/[id]). What they've done in The Labs,
   from the tables that already hold it — nothing new is collected.

   Deliberately left out: Learning Log content and its health check (clarity,
   alignment, blockers). SCHEMA.md keeps those between the member, their
   Poderator and admins; a reviewer judging an ambassador application needs
   participation, not a member's private reflections. Also out: pulse checks,
   survey answers, phone number, and anything else a member didn't put on
   their profile.

   Server-only (service-role reads). Every caller authorizes first. */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ApplicantRecord {
  profile: {
    id: number;
    name: string;
    email: string;
    handle: string | null;
    headline: string | null;
    bio: string | null;
    zip: string | null;
    work_situation: string | null;
    role_intents: string[];
    joined: string | null;
    lab: string | null;
  };
  /** Active role grants (participant_roles), as stored, e.g. "poderator". */
  roles: string[];
  cycles: { name: string; status: string }[];
  pods: { name: string; status: string | null }[];
  projects: { name: string; role: string | null }[];
  events: { count: number; recent: { name: string; start_at: string | null }[] };
  /** Agreements on file (agreement_acceptances), e.g. "participation". */
  agreements: { doc: string; version: string; accepted_at: string }[];
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

export async function applicantRecord(service: SupabaseClient, participantId: number): Promise<ApplicantRecord | null> {
  const { data: p } = await service
    .from("participants")
    .select("id, first_name, last_name, preferred_name, email, handle, headline, bio, zip, work_situation, role_intents, created_at, metro_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!p) return null;

  const [lab, roles, enrollments, pods, projectRoles, rsvps, agreements] = await Promise.all([
    p.metro_id ? service.from("metros").select("name").eq("id", p.metro_id).maybeSingle() : Promise.resolve({ data: null }),
    service.from("participant_roles").select("role").eq("participant_id", participantId).is("revoked_at", null),
    service.from("cycle_enrollments").select("cycle_id, status").eq("participant_id", participantId),
    service.from("pod_memberships").select("pod_id").eq("participant_id", participantId).is("inactive_at", null),
    service.from("project_roles").select("project_id, role").eq("participant_id", participantId).is("removed_at", null),
    service
      .from("event_rsvps")
      .select("event_id, created_at", { count: "exact" })
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false })
      .limit(5),
    service.from("agreement_acceptances").select("doc, version, accepted_at").eq("participant_id", participantId).order("accepted_at", { ascending: false }),
  ]);

  const ids = (rows: Row[] | null, key: string) => [...new Set((rows ?? []).map((r) => r[key] as number).filter(Boolean))];
  const cycleIds = ids(enrollments.data as Row[] | null, "cycle_id");
  const podIds = ids(pods.data as Row[] | null, "pod_id");
  const projectIds = ids(projectRoles.data as Row[] | null, "project_id");
  const eventIds = ids(rsvps.data as Row[] | null, "event_id");

  const [cycleRows, podRows, projectRows, eventRows] = await Promise.all([
    cycleIds.length ? service.from("cycles").select("id, name").in("id", cycleIds) : Promise.resolve({ data: [] }),
    podIds.length ? service.from("pods").select("id, name, status").in("id", podIds) : Promise.resolve({ data: [] }),
    projectIds.length ? service.from("projects").select("id, name").in("id", projectIds) : Promise.resolve({ data: [] }),
    eventIds.length ? service.from("events").select("id, name, start_at").in("id", eventIds) : Promise.resolve({ data: [] }),
  ]);
  const byId = (rows: Row[] | null) => new Map((rows ?? []).map((r) => [r.id as number, r]));
  const cyclesById = byId(cycleRows.data as Row[] | null);
  const projectsById = byId(projectRows.data as Row[] | null);
  const eventsById = byId(eventRows.data as Row[] | null);

  return {
    profile: {
      id: p.id,
      name: `${p.preferred_name || p.first_name} ${p.last_name}`.trim(),
      email: p.email,
      handle: str(p.handle),
      headline: str(p.headline),
      bio: str(p.bio),
      zip: str(p.zip),
      work_situation: str(p.work_situation),
      role_intents: Array.isArray(p.role_intents) ? (p.role_intents as string[]) : [],
      joined: str(p.created_at),
      lab: str((lab.data as Row | null)?.name),
    },
    roles: [...new Set(((roles.data ?? []) as Row[]).map((r) => r.role as string))].sort(),
    cycles: ((enrollments.data ?? []) as Row[]).map((e) => ({
      name: (cyclesById.get(e.cycle_id as number)?.name as string) ?? `Cycle ${e.cycle_id}`,
      status: e.status as string,
    })),
    pods: ((podRows.data ?? []) as Row[]).map((r) => ({ name: r.name as string, status: str(r.status) })),
    projects: ((projectRoles.data ?? []) as Row[]).map((r) => ({
      name: (projectsById.get(r.project_id as number)?.name as string) ?? `Project ${r.project_id}`,
      role: str(r.role),
    })),
    events: {
      count: rsvps.count ?? (rsvps.data ?? []).length,
      recent: ((rsvps.data ?? []) as Row[]).map((r) => {
        const e = eventsById.get(r.event_id as number);
        return { name: (e?.name as string) ?? "An event", start_at: str(e?.start_at) };
      }),
    },
    agreements: ((agreements.data ?? []) as Row[]).map((a) => ({
      doc: a.doc as string,
      version: a.version as string,
      accepted_at: a.accepted_at as string,
    })),
  };
}
