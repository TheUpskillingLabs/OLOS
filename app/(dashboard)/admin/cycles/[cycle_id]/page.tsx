import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { resolveUserRoles, isAdmin } from "@/lib/auth/roles";
import { StatCard, StatusBadge } from "@/app/components/ui";
import { cycleStatusVariant, cycleStatusLabel } from "@/lib/cycles/status";
import CycleStatusForm from "./cycle-status-form";
import { CycleScheduleForm, CycleParamsForm } from "./cycle-config-form";
import { CycleDetailsForm } from "./cycle-details-form";
import ParticipantsTable from "./participants-table";
import FinalizeVotingButton from "./finalize-voting-button";
import ResolveFormationButton from "./resolve-formation-button";
import RevocationsSection from "./revocations-section";
import AssignModeratorButton from "./assign-moderator-button";
import TestingControls from "./testing-controls";

type PodStatus = "active" | "forming" | "closed" | "inactive";

const POD_STATUS_VARIANT: Record<
  PodStatus,
  "active" | "forming" | "inactive"
> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

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
  // True when an access_revocations row exists for this (participant, cycle).
  // Combined with status='inactive', has_revocation=false identifies
  // 'stuck inactive' participants — never legitimately revoked, just
  // never activated in the first place (architecture review broken edge
  // #15). The participants-table filter uses this to surface them.
  has_revocation: boolean;
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
      .select("id, name, start_date, end_date, status, description, what_you_build")
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

  const { data: revocations } = await serviceClient
    .from("access_revocations")
    .select("participant_id, reason, revocation_scope, revoked_at, revoked_systems")
    .eq("cycle_id", cycleId)
    .order("revoked_at", { ascending: false });

  const revokedParticipantIds = new Set(
    (revocations ?? []).map((r) => r.participant_id)
  );

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
      has_revocation: revokedParticipantIds.has(e.participant_id),
    };
  });

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
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Admin
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="t-h1 text-ink">
            {cycle.name}
          </h1>
          <StatusBadge variant={cycleStatusVariant(cycle.status)}>
            {cycleStatusLabel(cycle.status)}
          </StatusBadge>
        </div>
        <p className="mt-1 text-sm text-meta tabular-nums">
          {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
          {new Date(cycle.end_date).toLocaleDateString()}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Enrolled" value={participants.length} />
        <StatCard
          label="Active"
          value={<span className="text-teal-deep">{activeCount}</span>}
        />
        <StatCard label="Pods" value={pods?.length ?? 0} />
      </div>

      <div className="space-y-10">
        {/* Status */}
        <section>
          <h2 className="mb-4 t-h3 text-ink">
            Cycle Status
          </h2>
          <CycleStatusForm cycleId={cycle.id} currentStatus={cycle.status} />
        </section>

        <hr className="border-ink/10" />

        {/* About / information page */}
        <section>
          <h2 className="mb-1 t-h3 text-ink">Information page</h2>
          <p className="mb-4 text-sm text-meta">
            Public-facing copy for this cycle&rsquo;s info page ({`/c/${cycle.id}`}).
          </p>
          <CycleDetailsForm
            cycleId={cycle.id}
            name={cycle.name}
            description={cycle.description}
            whatYouBuild={cycle.what_you_build}
          />
        </section>

        <hr className="border-ink/10" />

        {/* Schedule */}
        <section>
          <h2 className="mb-1 t-h3 text-ink">Schedule</h2>
          <p className="mb-4 text-sm text-meta">
            Open and close times for each phase.
          </p>
          {config && <CycleScheduleForm cycleId={cycle.id} config={config} />}
        </section>

        <hr className="border-ink/10" />

        {/* Parameters */}
        <section>
          <h2 className="mb-1 t-h3 text-ink">Parameters</h2>
          <p className="mb-4 text-sm text-meta">
            Voting thresholds and pod / project limits.
          </p>
          {config && <CycleParamsForm cycleId={cycle.id} config={config} />}
        </section>

        <hr className="border-ink/10" />

        {/* Pod Voting */}
        <section>
          <h2 className="mb-1 t-h3 text-ink">Pod Voting</h2>
          <p className="mb-4 text-sm text-meta">
            Finalize problem-statement voting to create pods. Uses AI to
            generate pod names.
          </p>
          <FinalizeVotingButton cycleId={cycle.id} />
        </section>

        <hr className="border-ink/10" />

        {/* Resolve Formation */}
        <section>
          <h2 className="mb-1 t-h3 text-ink">Resolve Formation</h2>
          <p className="mb-4 text-sm text-meta">
            After the pod and project registration windows close, dissolve any
            pods or projects that never reached their minimum size and reconcile
            affected members&rsquo; enrollments.
          </p>
          <ResolveFormationButton cycleId={cycle.id} />
        </section>

        <hr className="border-ink/10" />

        {/* Testing Controls */}
        <section>
          <h2 className="mb-1 t-h3 text-ink">
            Testing Mode
          </h2>
          <p className="mb-4 text-sm text-meta">
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
            <hr className="border-ink/10" />
            <section>
              <h2 className="mb-4 t-h3 text-ink">
                Pods ({pods.length})
              </h2>
              <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
                <table className="w-full text-sm">
                  <thead className="bg-ink/[0.02]">
                    <tr>
                      <th className="lbl px-4 py-3 text-left">
                        Pod
                      </th>
                      <th className="lbl px-4 py-3 text-left">
                        Status
                      </th>
                      <th className="lbl px-4 py-3 text-left">
                        Members
                      </th>
                      <th className="lbl px-4 py-3 text-left">
                        Moderators
                      </th>
                      <th className="lbl px-4 py-3 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/10">
                    {pods.map((pod) => {
                      const memberCount = (podMemberships ?? []).filter(
                        (m) => m.pod_id === pod.id
                      ).length;
                      return (
                        <tr
                          key={pod.id}
                          className="transition-colors duration-150 hover:bg-ink/[0.02]"
                        >
                          <td className="px-4 py-3 font-medium text-ink">
                            {pod.name ?? `Pod ${pod.id}`}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              variant={
                                POD_STATUS_VARIANT[pod.status as PodStatus] ??
                                "inactive"
                              }
                            >
                              {pod.status}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-3 text-meta tabular-nums">
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
                              className="text-sm font-semibold tracking-tight text-teal-deep transition-colors duration-150 hover:text-ink focus-visible:outline-none focus-visible:text-ink"
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

        <hr className="border-ink/10" />

        {/* Participants */}
        <section>
          <h2 className="mb-4 t-h3 text-ink">
            Participants ({participants.length})
          </h2>
          <ParticipantsTable participants={participants} cycleId={cycleId} />
        </section>

        <hr className="border-ink/10" />

        {/* Revocations */}
        <section>
          <h2 className="mb-1 t-h3 text-ink">
            Access Revocations
          </h2>
          <p className="mb-4 text-sm text-meta">
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
