import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import CycleStatusForm from "./cycle-status-form";
import { CycleScheduleForm, CycleParamsForm } from "./cycle-config-form";
import ParticipantsTable from "./participants-table";
import FinalizeVotingButton from "./finalize-voting-button";
import RevocationsSection from "./revocations-section";

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

  // Enrollments with participant data
  const { data: enrollments } = await serviceClient
    .from("cycle_enrollments")
    .select(
      `participant_id, status, inactive_date,
       participants ( id, first_name, last_name, preferred_name, email )`
    )
    .eq("cycle_id", cycleId);

  // Pods
  const { data: pods } = await serviceClient
    .from("pods")
    .select("id, name, status")
    .eq("cycle_id", cycleId)
    .order("created_at");

  // Pod memberships
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

  // Elevated roles for participants
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

  // Revocations
  const { data: revocations } = await serviceClient
    .from("access_revocations")
    .select("participant_id, reason, revocation_scope, revoked_at, revoked_systems")
    .eq("cycle_id", cycleId)
    .order("revoked_at", { ascending: false });

  const activeCount = participants.filter((p) => p.status === "active").length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          &larr; Admin
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {cycle.name}
          </h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              cycle.status === "active"
                ? "bg-green-100 text-green-800"
                : cycle.status === "closed"
                  ? "bg-zinc-100 text-zinc-600"
                  : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {cycle.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
          {new Date(cycle.end_date).toLocaleDateString()}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-10 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Enrolled</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {participants.length}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">Pods</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {pods?.length ?? 0}
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {/* Status */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Cycle Status
          </h2>
          <CycleStatusForm cycleId={cycle.id} currentStatus={cycle.status} />
        </section>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Schedule */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Schedule
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Open and close times for each phase.
          </p>
          {config && <CycleScheduleForm cycleId={cycle.id} config={config} />}
        </section>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Parameters */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Parameters
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Voting thresholds and pod / project limits.
          </p>
          {config && <CycleParamsForm cycleId={cycle.id} config={config} />}
        </section>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Pod Voting */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Pod Voting
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
            Finalize problem-statement voting to create pods. Uses AI to
            generate pod names.
          </p>
          <FinalizeVotingButton cycleId={cycle.id} />
        </section>

        {pods && pods.length > 0 && (
          <>
            <hr className="border-zinc-200 dark:border-zinc-800" />
            <section>
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Pods ({pods.length})
              </h2>
              <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                        Pod
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                        Members
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                    {pods.map((pod) => {
                      const memberCount = (podMemberships ?? []).filter(
                        (m) => m.pod_id === pod.id
                      ).length;
                      return (
                        <tr key={pod.id}>
                          <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                            {pod.name ?? `Pod ${pod.id}`}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                pod.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : pod.status === "forming"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {pod.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">
                            {memberCount}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/pods/${pod.id}`}
                              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
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

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Participants */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Participants ({participants.length})
          </h2>
          <ParticipantsTable participants={participants} />
        </section>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        {/* Revocations */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Access Revocations
          </h2>
          <p className="mb-4 text-sm text-zinc-500">
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
