import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { one } from "@/lib/supabase/embed";
import PeopleWorkspace, { type PeopleTab } from "./people-workspace";
import PeopleTable from "./people-table";
import InvitationsTable from "./invitations-table";
import type { Person } from "./types";

export default async function AdminPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const { userRoles, serviceClient } = await requireAdmin();
  const canManageRoles = can(userRoles, "roles:write");

  // ── Participants (global master list) ──
  const { data: participants } = await serviceClient
    .from("participants")
    .select("id, first_name, last_name, preferred_name, email, created_at, is_test")
    .order("created_at", { ascending: false });

  const participantIds = participants?.map((p) => p.id) ?? [];

  const [{ data: allRoles }, { data: allEnrollments }, { data: allModAssignments }] =
    await Promise.all([
      participantIds.length
        ? serviceClient.from("user_roles").select("participant_id, role").in("participant_id", participantIds).is("revoked_at", null)
        : Promise.resolve({ data: [] as { participant_id: number; role: string }[] }),
      participantIds.length
        ? serviceClient.from("cycle_enrollments").select("participant_id, status, cycle_id, cycles (name)").in("participant_id", participantIds)
        : Promise.resolve({ data: [] as { participant_id: number; status: string; cycle_id: number; cycles: unknown }[] }),
      participantIds.length
        ? serviceClient.from("moderator_assignments").select("participant_id, pod_id, pods (name)").in("participant_id", participantIds).is("removed_at", null)
        : Promise.resolve({ data: [] as { participant_id: number; pod_id: number; pods: unknown }[] }),
    ]);

  const rolesByParticipant: Record<number, string[]> = {};
  for (const r of allRoles ?? []) {
    (rolesByParticipant[r.participant_id] ??= []).push(r.role);
  }

  const cyclesByParticipant: Record<number, { cycle_id: number; cycle_name: string; status: string }[]> = {};
  for (const e of allEnrollments ?? []) {
    const c = (e.cycles as unknown) as { name: string } | null;
    (cyclesByParticipant[e.participant_id] ??= []).push({
      cycle_id: e.cycle_id,
      cycle_name: c?.name ?? "",
      status: e.status,
    });
  }

  const modPodsByParticipant: Record<number, { pod_id: number; pod_name: string }[]> = {};
  for (const ma of allModAssignments ?? []) {
    const pod = (ma.pods as unknown) as { name: string | null } | null;
    (modPodsByParticipant[ma.participant_id] ??= []).push({
      pod_id: ma.pod_id,
      pod_name: pod?.name ?? `Pod ${ma.pod_id}`,
    });
  }

  const people: Person[] = (participants ?? []).map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    preferred_name: p.preferred_name,
    email: p.email,
    created_at: p.created_at,
    is_test: !!p.is_test,
    roles: rolesByParticipant[p.id] ?? [],
    cycles: cyclesByParticipant[p.id] ?? [],
    moderator_pods: modPodsByParticipant[p.id] ?? [],
  }));

  // ── Invitations ──
  const [{ data: invitations }, { data: cycles }, { data: pods }] = await Promise.all([
    serviceClient
      .from("invitations")
      .select("id, email, token, permissions, role_preset, cycle_id, pod_id, pod_role, status, created_at, expires_at, accepted_at, email_sent_at, cycles (name)")
      .order("created_at", { ascending: false }),
    serviceClient.from("cycles").select("id, name, status").order("start_date", { ascending: false }),
    serviceClient.from("pods").select("id, name, cycle_id, cycles (name, mode)").order("created_at", { ascending: false }),
  ]);

  const podOptions = (pods ?? []).map((p) => {
    const cycle = one(p.cycles as { name: string; mode: string } | { name: string; mode: string }[] | null);
    return {
      id: p.id,
      name: p.name ?? `Pod ${p.id}`,
      cycle_name: cycle?.name ?? "",
      mode: cycle?.mode ?? null,
    };
  });

  const invitationRows = (invitations ?? []).map((inv) => {
    const cycle = (inv.cycles as unknown) as { name: string } | null;
    return {
      id: inv.id,
      email: inv.email,
      token: inv.token,
      permissions: inv.permissions as string[],
      role_preset: inv.role_preset,
      cycle_id: inv.cycle_id,
      cycle_name: cycle?.name ?? null,
      pod_id: inv.pod_id,
      pod_role: inv.pod_role,
      status: inv.status,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      accepted_at: inv.accepted_at,
      email_sent_at: inv.email_sent_at ?? null,
    };
  });

  const initialTab: PeopleTab = tab === "invitations" ? "invitations" : "participants";

  return (
    <div>
      <div className="mb-8">
        <h1 className="t-h1 text-ink">People &amp; access</h1>
        <p className="mt-1 text-sm text-meta tabular-nums">
          {people.length} participant{people.length !== 1 ? "s" : ""} · permissions, roles, and invitations
        </p>
      </div>

      <PeopleWorkspace
        initialTab={initialTab}
        participantsPanel={
          <PeopleTable people={people} canManageRoles={canManageRoles} />
        }
        invitationsPanel={
          <InvitationsTable
            invitations={invitationRows}
            cycles={(cycles ?? []).map((c) => ({ id: c.id, name: c.name }))}
            pods={podOptions}
            canManageRoles={canManageRoles}
          />
        }
      />
    </div>
  );
}
