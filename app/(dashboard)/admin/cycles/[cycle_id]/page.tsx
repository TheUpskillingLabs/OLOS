import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { can } from "@/lib/auth/roles";
import { StatCard, StatusBadge } from "@/app/components/ui";
import CycleStatusForm from "./cycle-status-form";
import { CycleScheduleForm, CycleParamsForm } from "./cycle-config-form";
import CycleLogGateForm from "./cycle-log-gate-form";
import CycleLeadershipLogGateForm from "./cycle-leadership-log-gate-form";
import ParticipantsTable from "./participants-table";
import FinalizeVotingButton from "./finalize-voting-button";
import RevocationsSection from "./revocations-section";
import TestingControls from "./testing-controls";
import PodsTable, { type PodAdminRow } from "./pods-table";
import WorkstreamsPanel, {
  type WorkstreamAdminRow,
  type PriorOrgCycleOption,
} from "./workstreams-panel";
import CycleWorkspaceTabs from "./cycle-workspace-tabs";
import { resolveInitialTab } from "./cycle-tabs";
import { podNoun, cycleStatusVariant } from "@/lib/cycle/labels";
import { one } from "@/lib/supabase/embed";

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
  searchParams,
}: {
  params: Promise<{ cycle_id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { cycle_id } = await params;
  const { tab } = await searchParams;
  const { userRoles, serviceClient } = await requireAdmin();

  const cycleId = parseInt(cycle_id);

  const [{ data: cycle }, { data: config }] = await Promise.all([
    serviceClient
      .from("cycles")
      .select("id, name, start_date, end_date, status, mode, lab_id, metros(name)")
      .eq("id", cycleId)
      .single(),
    serviceClient
      .from("cycle_config")
      .select("*")
      .eq("cycle_id", cycleId)
      .single(),
  ]);

  if (!cycle) notFound();

  const isOrg = cycle.mode === "org";
  // Local Labs (docs/LOCAL_LABS.md): lab cycles carry a lab badge in the
  // header so HQ admins can tell whose stream they're editing.
  const labName = one(cycle.metros as { name: string } | { name: string }[] | null)
    ?.name;

  const { data: cycleSurveys } = await serviceClient
    .from("field_surveys")
    .select("id, title, share_slug, status")
    .eq("cycle_id", cycleId)
    .order("id", { ascending: false });

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

  // Participant list for the moderator + add-member dropdowns.
  const participantOptions = participants.map((p) => ({
    participant_id: p.participant_id,
    name: p.preferred_name
      ? `${p.preferred_name} ${p.last_name}`
      : `${p.first_name} ${p.last_name}`,
  }));

  // Pod rows with named members + moderators for the Formation tab.
  const nameByParticipant = new Map(
    participantOptions.map((p) => [p.participant_id, p.name])
  );
  const membersByPod: Record<number, { participant_id: number; name: string }[]> = {};
  for (const m of podMemberships ?? []) {
    (membersByPod[m.pod_id] ??= []).push({
      participant_id: m.participant_id,
      name: nameByParticipant.get(m.participant_id) ?? `Participant ${m.participant_id}`,
    });
  }
  // Projects per pod — drives the Finalize-projects affordance in the pod
  // Manage drawer (hidden once a pod's projects exist; finalize is
  // append-only and idempotency-guarded).
  const { data: cycleProjects } = podIds.length
    ? await serviceClient
        .from("projects")
        .select("id, pod_id")
        .in("pod_id", podIds)
    : { data: [] as { id: number; pod_id: number }[] };

  const projectCountByPod: Record<number, number> = {};
  for (const proj of cycleProjects ?? []) {
    projectCountByPod[proj.pod_id] = (projectCountByPod[proj.pod_id] ?? 0) + 1;
  }

  const podAdminRows: PodAdminRow[] = (pods ?? []).map((pod) => ({
    id: pod.id,
    name: pod.name,
    status: pod.status,
    members: membersByPod[pod.id] ?? [],
    moderators: moderatorsByPod[pod.id] ?? [],
    projectCount: projectCountByPod[pod.id] ?? 0,
  }));

  // Formation-tab workstreams roster — org cycles only (docs/ORG_CYCLES.md
  // §2/§5): the workstream list scoped to this cycle's runs, plus prior org
  // cycles for the copy-roster dropdown.
  let workstreamRows: WorkstreamAdminRow[] = [];
  let priorOrgCycles: PriorOrgCycleOption[] = [];
  let orgParticipantOptions: { participant_id: number; name: string; email?: string }[] = [];
  if (isOrg) {
    // Scoped to this cycle's stream (HQ vs. lab) — wrong-stream options
    // previously failed with 400/404 at charter/copy time; this is scoping,
    // not errors (PRD-lab-lead-ux §3.5).
    let wsQuery = serviceClient
      .from("workstreams")
      .select("id, name, description, status")
      .order("name");
    wsQuery = cycle.lab_id
      ? wsQuery.eq("lab_id", cycle.lab_id)
      : wsQuery.is("lab_id", null);

    let priorCyclesQuery = serviceClient
      .from("cycles")
      .select("id, name")
      .eq("mode", "org")
      .neq("id", cycleId);
    priorCyclesQuery = cycle.lab_id
      ? priorCyclesQuery.eq("lab_id", cycle.lab_id)
      : priorCyclesQuery.is("lab_id", null);
    priorCyclesQuery = priorCyclesQuery.order("start_date", { ascending: false });

    const [
      { data: workstreamsData },
      { data: runPods },
      { data: priorCycles },
      { data: allParticipants },
    ] = await Promise.all([
      wsQuery,
      serviceClient
        .from("pods")
        .select("id, name, workstream_id")
        .eq("cycle_id", cycleId)
        .not("workstream_id", "is", null),
      priorCyclesQuery,
      // Org runs are invite-only and cross-lab: the add-member and co-lead
      // pickers draw from EVERY registered participant, not just this
      // cycle's enrollees (which is empty on a fresh org cycle — the
      // chicken-and-egg the email-invite flow can't solve for people who
      // already have accounts).
      serviceClient
        .from("participants")
        .select("id, first_name, last_name, preferred_name, email")
        .order("last_name"),
    ]);
    orgParticipantOptions = (allParticipants ?? []).map((p) => ({
      participant_id: p.id,
      name: p.preferred_name
        ? `${p.preferred_name} ${p.last_name}`
        : `${p.first_name} ${p.last_name}`,
      email: p.email,
    }));

    const runByWorkstream = new Map<number, { pod_id: number; name: string | null }>();
    for (const run of runPods ?? []) {
      if (run.workstream_id) {
        runByWorkstream.set(run.workstream_id, { pod_id: run.id, name: run.name });
      }
    }

    workstreamRows = (workstreamsData ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      status: w.status,
      run: runByWorkstream.get(w.id) ?? null,
    }));
    priorOrgCycles = priorCycles ?? [];
  }

  const canTesting = can(userRoles, "testing:use");
  const showDev = canTesting && !isOrg;
  const initialTab = resolveInitialTab(tab, showDev);

  const overview = (
    <div className="space-y-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={isOrg ? "Core contributors" : "Enrolled"}
          value={participants.length}
        />
        <StatCard
          label="Active"
          value={<span className="text-teal-deep">{activeCount}</span>}
        />
        <StatCard label={podNoun(cycle.mode, true)} value={pods?.length ?? 0} />
      </div>
      <section>
        <h2 className="mb-1 t-h3 text-ink">Cycle status</h2>
        <p className="mb-4 text-sm text-meta">
          Move the cycle through its lifecycle.
          {!isOrg && " Phase windows live in Configuration."}
        </p>
        <CycleStatusForm
          cycleId={cycle.id}
          currentStatus={cycle.status}
          mode={cycle.mode}
        />
      </section>
    </div>
  );

  const configuration = config ? (
    <div className="space-y-10">
      {!isOrg && (
        <>
          <section>
            <h2 className="mb-1 t-h3 text-ink">Schedule</h2>
            <p className="mb-4 text-sm text-meta">
              Open and close times for each phase.
            </p>
            <CycleScheduleForm cycleId={cycle.id} config={config} />
          </section>
          <hr className="border-ink/10" />
        </>
      )}
      <section>
        <h2 className="mb-1 t-h3 text-ink">Parameters</h2>
        <p className="mb-4 text-sm text-meta">
          {isOrg
            ? "Workstream limits and milestone review weeks."
            : "Voting thresholds and pod / project limits."}
        </p>
        <CycleParamsForm cycleId={cycle.id} config={config} mode={cycle.mode} />
      </section>
      <hr className="border-ink/10" />
      <section>
        <CycleLogGateForm
          cycleId={cycle.id}
          logDueAt={config.log_due_at}
          gatePaused={config.log_gate_paused}
        />
        {isOrg && (
          <div className="mt-4">
            <CycleLeadershipLogGateForm
              cycleId={cycle.id}
              dueAt={config.leadership_log_due_at}
              paused={config.leadership_log_gate_paused}
            />
          </div>
        )}
      </section>
      <hr className="border-ink/10" />
      <section>
        <h2 className="mb-1 t-h3 text-ink">Field survey</h2>
        <p className="mb-4 text-sm text-meta">
          The cohort&apos;s opening activity — the observations that seed this
          cycle&apos;s problems. Edit questions in the builder; export responses
          from Results.
        </p>
        {cycleSurveys && cycleSurveys.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {cycleSurveys.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-ink/10 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-ink">
                  {s.title}
                  <span className="ml-2 text-xs text-meta">· {s.status}</span>
                </span>
                <span className="flex gap-4">
                  <Link
                    href={`/admin/surveys/${s.share_slug}`}
                    className="text-sm font-semibold text-teal-deep hover:underline"
                  >
                    Edit questions
                  </Link>
                  <Link
                    href={`/survey/${s.share_slug}/results`}
                    className="text-sm font-semibold text-teal-deep hover:underline"
                  >
                    Results &amp; CSV
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-meta">
            No survey linked to this cycle yet.{" "}
            <Link
              href="/admin/surveys"
              className="font-semibold text-teal-deep hover:underline"
            >
              Create one
            </Link>{" "}
            and set its cycle to this one.
          </p>
        )}
      </section>
    </div>
  ) : (
    <p className="text-sm text-meta">No configuration row found for this cycle.</p>
  );

  const formation = (
    <div className="space-y-10">
      {isOrg ? (
        <section>
          <h2 className="mb-1 t-h3 text-ink">Charter runs</h2>
          <p className="mb-4 text-sm text-meta">
            Charter this cycle&rsquo;s runs from the org&rsquo;s durable
            workstreams, optionally copying a prior run&rsquo;s roster
            forward.
          </p>
          <WorkstreamsPanel
            cycleId={cycle.id}
            workstreams={workstreamRows}
            priorOrgCycles={priorOrgCycles}
          />
        </section>
      ) : (
        <section>
          <h2 className="mb-1 t-h3 text-ink">Pod voting</h2>
          <p className="mb-4 text-sm text-meta">
            Finalize problem-statement voting to create pods. Uses AI to
            generate pod names.
          </p>
          <FinalizeVotingButton cycleId={cycle.id} cycleName={cycle.name} />
        </section>
      )}
      <hr className="border-ink/10" />
      <section>
        <h2 className="mb-4 t-h3 text-ink">
          {isOrg ? "Chartered runs" : podNoun(cycle.mode, true)} (
          {pods?.length ?? 0})
        </h2>
        <PodsTable
          cycleId={cycle.id}
          pods={podAdminRows}
          participants={isOrg ? orgParticipantOptions : participantOptions}
          mode={cycle.mode}
        />
      </section>
    </div>
  );

  const people = (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 t-h3 text-ink">
          {isOrg ? "Core contributors" : "Participants"} ({participants.length})
        </h2>
        <ParticipantsTable
          participants={participants}
          cycleId={cycleId}
          mode={cycle.mode}
        />
      </section>
      {!isOrg && (
        <>
          <hr className="border-ink/10" />
          <section>
            <h2 className="mb-1 t-h3 text-ink">Access revocations</h2>
            <p className="mb-4 text-sm text-meta">
              Check for inactive participants and manage revocations.
            </p>
            <RevocationsSection
              cycleId={cycle.id}
              initialRevocations={revocations ?? []}
              participants={participants}
            />
          </section>
        </>
      )}
    </div>
  );

  const dev = isOrg
    ? null
    : config
      ? (
        <div className="rounded-card border border-red/30 bg-red/[0.03] p-5">
          <h2 className="mb-1 t-h3 text-ink">Testing controls</h2>
          <p className="mb-4 text-sm text-meta">
            Fast-forward the cycle one phase at a time. This rewrites the
            phase-window timestamps in the schedule — for testing only.
          </p>
          <TestingControls
            cycleId={cycle.id}
            initialConfig={config as unknown as Record<string, unknown>}
          />
        </div>
      )
      : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Admin
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="t-h1 text-ink">{cycle.name}</h1>
          <StatusBadge variant={cycleStatusVariant(cycle.status)}>
            {cycle.status}
          </StatusBadge>
          {isOrg && <StatusBadge variant="forming">organization</StatusBadge>}
          {labName && <StatusBadge variant="draft">{labName}</StatusBadge>}
        </div>
        <p className="mt-1 text-sm text-meta tabular-nums">
          {new Date(cycle.start_date).toLocaleDateString()} &ndash;{" "}
          {new Date(cycle.end_date).toLocaleDateString()}
        </p>
      </div>

      <CycleWorkspaceTabs
        initialTab={initialTab}
        showDev={showDev}
        overview={overview}
        configuration={configuration}
        formation={formation}
        people={people}
        dev={dev}
        labels={isOrg ? { formation: "Workstreams", people: "Core contributors" } : undefined}
      />
    </div>
  );
}
