import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import ParticipantsGlobalTable from "./participants-global-table";

export type GlobalParticipant = {
  id: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
  created_at: string;
  roles: string[];
  cycles: { cycle_id: number; cycle_name: string; status: string }[];
  moderator_pods: { pod_id: number; pod_name: string }[];
};

export default async function AdminParticipantsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles)) redirect("/cycles");

  // Fetch all participants
  const { data: participants } = await serviceClient
    .from("participants")
    .select("id, first_name, last_name, preferred_name, email, created_at")
    .order("created_at", { ascending: false });

  const participantIds = participants?.map((p) => p.id) ?? [];

  // Fetch all elevated roles
  const { data: allRoles } = participantIds.length
    ? await serviceClient
        .from("user_roles")
        .select("participant_id, role")
        .in("participant_id", participantIds)
        .is("revoked_at", null)
    : { data: [] as { participant_id: number; role: string }[] };

  const rolesByParticipant: Record<number, string[]> = {};
  for (const r of allRoles ?? []) {
    (rolesByParticipant[r.participant_id] ??= []).push(r.role);
  }

  // Fetch all cycle enrollments with cycle names
  const { data: allEnrollments } = participantIds.length
    ? await serviceClient
        .from("cycle_enrollments")
        .select("participant_id, status, cycle_id, cycles (name)")
        .in("participant_id", participantIds)
    : { data: [] as { participant_id: number; status: string; cycle_id: number; cycles: unknown }[] };

  const cyclesByParticipant: Record<number, { cycle_id: number; cycle_name: string; status: string }[]> = {};
  for (const e of allEnrollments ?? []) {
    const c = (e.cycles as unknown) as { name: string } | null;
    (cyclesByParticipant[e.participant_id] ??= []).push({
      cycle_id: e.cycle_id,
      cycle_name: c?.name ?? "",
      status: e.status,
    });
  }

  // Fetch all moderator assignments
  const { data: allModAssignments } = participantIds.length
    ? await serviceClient
        .from("moderator_assignments")
        .select("participant_id, pod_id, pods (name)")
        .in("participant_id", participantIds)
        .is("removed_at", null)
    : { data: [] as { participant_id: number; pod_id: number; pods: unknown }[] };

  const modPodsByParticipant: Record<number, { pod_id: number; pod_name: string }[]> = {};
  for (const ma of allModAssignments ?? []) {
    const pod = (ma.pods as unknown) as { name: string | null } | null;
    (modPodsByParticipant[ma.participant_id] ??= []).push({
      pod_id: ma.pod_id,
      pod_name: pod?.name ?? `Pod ${ma.pod_id}`,
    });
  }

  const globalParticipants: GlobalParticipant[] = (participants ?? []).map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    preferred_name: p.preferred_name,
    email: p.email,
    created_at: p.created_at,
    roles: rolesByParticipant[p.id] ?? [],
    cycles: cyclesByParticipant[p.id] ?? [],
    moderator_pods: modPodsByParticipant[p.id] ?? [],
  }));

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-cloud/60 transition-colors duration-150 hover:text-aqua focus-visible:outline-none focus-visible:text-aqua"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Admin
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          All participants
        </h1>
        <p className="mt-1 text-sm text-cloud/60 tabular-nums">
          {globalParticipants.length} registered participant
          {globalParticipants.length !== 1 ? "s" : ""} across all cycles
        </p>
      </div>

      <ParticipantsGlobalTable
        participants={globalParticipants}
      />
    </div>
  );
}
