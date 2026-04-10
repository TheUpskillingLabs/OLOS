import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import CycleStatusForm from "./cycle-status-form";
import { CycleScheduleForm, CycleParamsForm } from "./cycle-config-form";
import ParticipantsTable from "./participants-table";
import FinalizeVotingButton from "./finalize-voting-button";
import RevocationsSection from "./revocations-section";
import AssignModeratorButton from "./assign-moderator-button";
import TestingControls from "./testing-controls";

export type ParticipantRow = {
  participant_id: number;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string;
  status: string;
  inactive_date: string | null;
  pods: number[];
  roles: string[];
};

export default async function AdminCycleDetailPage({
  params,
}: {
  params: Promise<{ cycle_id: string }>;
}) {
  const { cycle_id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = createServiceClient();
  const userRoles = await resolveUserRoles(serviceClient, user.id);
  if (!isAdmin(userRoles)) redirect("/cycles");

  const cycleId = parseInt(cycle_id);

  const [{ data: cycle }, { data: config }] = await Promise.all([
    serviceClient
      .from("cycles")
      .select("id, name, start_date, end_date, status")
      .eq("id", cycleId)
      .single(),
    serviceClient
      .from("cycle_config")
      .select("*")
      .eq("cycle_id", cycleId)
      .single(),
  ]);

  if (!cycle) notFound();

  const { data: enrollments } = await serviceClient
    .from("cycle_enrollments")
    .select(
      `participant_id, status, inactive_date,
       participants ( id, first_name, last_name, preferred_name, email )`
    )
    .eq("cycle_id", cycleId);

  const { data: pods } = await serviceClient
    .from("pods")
    .select("id, name, status")
    .eq("cycle_id", cycleId)
    .order("created_at");

  const podIds = pods?.map((p) => p.id) ?? [];
  const { data: podMemberships } = podIds.length
    ? await serviceClient
        .from("pod_memberships")
        .select("participant_id, pod_id")
        .in("pod_id", podIds)
        .is("inactive_at", null)
    : { data: [] as { participant_id: number; pod_id: number }[] };

  const podsByParticipant: Record<number, number[]> = {};
  for (const m of podMemberships ?? []) {
    (podsByParticipant[m.participant_id] ??= []).push(m.pod_id);
  }

  // Fetch moderator assignments for all pods in this cycle
  const { data: modAssignments } = podIds.length
    ? await serviceClient
        .from("moderator_assignments")
        .select("participant_id, pod_id, assigned_at, participants (first_name, last_name, preferred_name)")
        .in("pod_id", podIds)
        .is("removed_at", null)
    : { data: [] as { participant_id: number; pod_id: number; assigned_at: string; participants: unknown }[] };

  const moderatorsByPod: Record<number, { participant_id: number; name: string; assigned_at: string }[]> = {};
  for (const ma of modAssignments ?? []) {
    const p = (ma.participants as unknown) as { first_name: string; last_name: string; preferred_name: string | null } | null;
    const name = p ? `${p.preferred_name || p.first_name} ${p.last_name}`.trim() : "";
    (moderatorsByPod[ma.pod_id] ??= []).push({
      participant_id: ma.participant_id,
      name,
      assigned_at: ma.assigned_at,
    });
  }

  const participantIds = enrollments?.map((e) => e.participant_id) ?? [];
  const { data: elevatedRoles } = participantIds.length
    ? await serviceClient
        .from("user_roles")
        .select("participant_id, role")
        .in("participant_id", participantIds)
        .is("revoked_at", null)
    : { data: [] as { participant_id: number; role: string }[] };

  const rolesByParticipant: Record<number, string[]> = {};
  for (const r of elevatedRoles ?? []) {
    (rolesByParticipant[r.participant_id] ??= []).push(r.role);
  }

  const participants: ParticipantRow[] = (enrollments ?? []).map((e) => {
    const p = (e.participants as unknown) as {
      first_name: string;
      last_name: string;
      preferred_name: string | null;
      email: string;
    } | null;
    return {
      participant_id: e.participant_id,
      first_name: p?.first_name ?? "",
      last_name: p?.last_name ?? "",
      preferred_name: p?.preferred_name ?? null,
      email: p?.email ?? "",
      status: e.status,
      inactive_date: e.inactive_date,
      pods: podsByParticipant[e.participant_id] ?? [],
      roles: rolesByParticipant[e.participant_id] ?? [],
    };
  });

  const { data: revocations } = await serviceClient
    .from("access_revocations")
    .select("participant_id, reason, revocation_scope, revoked_at, revoked_systems")
    .eq("cycle_id", cycleId)
    .order("revoked_at", { ascending: false });

  const activeCount = participants.filter((p) => p.status === "active").length;

  // Participant list for moderator assignment dropdown
  const participantOptions = participants.map((p) => ({
    participant_id: p.participant_id,
    name: p.preferred_name
      ? `${p.preferred_name} ${p.last_name}`
      : `${p.first_name} ${p.last_name}`,
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-cloud/60 hover:text-aqua"
        >
          &larr; Admin
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-white">{cycle.name}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              cycle.status === "active"
                ? "bg-teal/20 text-aqua"
                : cycle.status === "closed"
                  ? "bg-white/10 text-cloud/60"
                  : "bg-yellow-500/20 text-yellow-300"
            }`}
          >
            {cycle.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-cloud/60">
          {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
          {new Date(cycle.end_date).toLocaleDateString()}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-10 grid grid-cols-3 gap-4">
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Enrolled</p>
          <p className="text-2xl font-bold text-white">{participants.length}</p>
        </div>
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Active</p>
          <p className="text-2xl font-bold text-aqua">{activeCount}</p>
        </div>
        <div className="rounded-md border border-whisper bg-white/[0.02] p-4">
          <p className="text-sm text-cloud/60">Pods</p>
          <p className="text-2xl font-bold text-white">{pods?.length ?? 0}</p>
        </div>
      </div>

      <div className="space-y-10">
        {/* Status */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Cycle Status
          </h2>
          <CycleStatusForm cycleId={cycle.id} currentStatus={cycle.status} />
        </section>

        <hr className="border-whisper" />

        {/* Schedule */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-white">Schedule</h2>
          <p className="mb-4 text-sm text-cloud/60">
            Open and close times for each phase.
          </p>
          {config && <CycleScheduleForm cycleId={cycle.id} config={config} />}
        </section>

        <hr className="border-whisper" />

        {/* Parameters */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-white">Parameters</h2>
          <p className="mb-4 text-sm text-cloud/60">
            Voting thresholds and pod / project limits.
          </p>
          {config && <CycleParamsForm cycleId={cycle.id} config={config} />}
        </section>

        <hr className="border-whisper" />

        {/* Pod Voting */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-white">Pod Voting</h2>
          <p className="mb-4 text-sm text-cloud/60">
            Finalize problem-statement voting to create pods. Uses AI to
            generate pod names.
          </p>
          <FinalizeVotingButton cycleId={cycle.id} />
        </section>

        <hr className="border-whisper" />

        {/* Testing Controls */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-white">
            Testing Mode
          </h2>
          <p className="mb-4 text-sm text-cloud/60">
            Advance through cycle phases one step at a time for testing.
          </p>
          {config && (
            <TestingControls
              cycleId={cycle.id}
              initialConfig={config as unknown as Record<string, unknown>}
            />
          )}
        </section>

        {pods && pods.length > 0 && (
          <>
            <hr className="border-whisper" />
            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">
                Pods ({pods.length})
              </h2>
              <div className="overflow-hidden rounded-md border border-whisper">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.04]">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-cloud/60">
                        Pod
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-cloud/60">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-cloud/60">
                        Members
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-cloud/60">
                        Moderators
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-cloud/60" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-whisper">
                    {pods.map((pod) => {
                      const memberCount = (podMemberships ?? []).filter(
                        (m) => m.pod_id === pod.id
                      ).length;
                      return (
                        <tr key={pod.id}>
                          <td className="px-4 py-3 font-medium text-white">
                            {pod.name ?? `Pod ${pod.id}`}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                pod.status === "active"
                                  ? "bg-teal/20 text-aqua"
                                  : pod.status === "forming"
                                    ? "bg-teal/10 text-teal"
                                    : "bg-white/10 text-cloud/60"
                              }`}
                            >
                              {pod.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-cloud/60">
                            {memberCount}
                          </td>
                          <td className="px-4 py-3">
                            <AssignModeratorButton
                              podId={pod.id}
                              cycleId={cycle.id}
                              participants={participantOptions}
                              initialModerators={moderatorsByPod[pod.id] ?? []}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/pods/${pod.id}`}
                              className="text-sm text-cloud/60 hover:text-aqua"
                            >
                              View &rarr;
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <hr className="border-whisper" />

        {/* Participants */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Participants ({participants.length})
          </h2>
          <ParticipantsTable participants={participants} />
        </section>

        <hr className="border-whisper" />

        {/* Revocations */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-white">
            Access Revocations
          </h2>
          <p className="mb-4 text-sm text-cloud/60">
            Check for inactive participants and manage revocations.
          </p>
          <RevocationsSection
            cycleId={cycle.id}
            initialRevocations={revocations ?? []}
            participants={participants}
          />
        </section>
      </div>
    </div>
  );
}
