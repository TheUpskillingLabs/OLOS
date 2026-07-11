import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { resolveUserRoles, isAdmin, isModeratorForPod, can } from "@/lib/auth/roles";
import { StatusBadge } from "@/app/components/ui";
import { podNoun } from "@/lib/cycle/labels";
import { one } from "@/lib/supabase/embed";
import PulseCheckDashboard from "./pulse-check-dashboard";
import CharterProjectForm from "./charter-project-form";
import FollowButton from "@/app/components/follow-button";
import PageUpdatesSection from "@/app/(dashboard)/page-updates-section";
import { resolvePageContext } from "@/lib/pages/server";

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

export default async function PodDetailPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pod } = await supabase
    .from("pods")
    .select(
      "id, name, status, cycle_id, workstream_id, problem_statement_id, problem_statements(statement_text), cycles(mode)"
    )
    .eq("id", parseInt(pod_id))
    .single();

  if (!pod) notFound();

  const mode = one(
    pod.cycles as { mode: string } | { mode: string }[] | null
  )?.mode;

  const { data: members } = await supabase
    .from("pod_memberships")
    .select(
      "participant_id, joined_at, inactive_at, participants(first_name, last_name, preferred_name)"
    )
    .eq("pod_id", pod.id)
    .order("joined_at");

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, status")
    .eq("pod_id", pod.id)
    .order("created_at");

  const ps = (pod.problem_statements as unknown) as Record<string, string> | null;

  // Check if viewer is admin or moderator for this pod
  const userRoles = user
    ? await resolveUserRoles(serviceClient, user.id)
    : null;
  // Cross-pod access requires `participants:read` (granted to owner/admin/observer),
  // NOT `pulse_checks:read` — moderators have the latter globally per 00009 but
  // must remain pod-scoped via isModeratorForPod for their assigned pod.
  const canViewDashboard =
    userRoles &&
    (isAdmin(userRoles) ||
      isModeratorForPod(userRoles, pod.id) ||
      can(userRoles, "participants:read"));

  // Org run pods (docs/ORG_CYCLES.md §2/§5) let their co-leads charter new
  // projects directly on the pod, no solution-proposal ballot required.
  const canCharter =
    mode === "org" &&
    pod.workstream_id != null &&
    !!userRoles &&
    (isAdmin(userRoles) || isModeratorForPod(userRoles, pod.id));

  // Fetch pulse check data for dashboard (using service client to bypass RLS)
  let pulseCheckData: {
    participant_id: number;
    name: string;
    checks: {
      scheduled_date: string;
      completed_at: string | null;
      survey_responses: Record<string, unknown> | null;
      nomination_count: number;
    }[];
  }[] = [];

  if (canViewDashboard && members && members.length > 0) {
    const memberIds = members.map((m) => m.participant_id);

    const { data: pulseChecks } = await serviceClient
      .from("pulse_checks")
      .select("id, participant_id, scheduled_date, completed_at, survey_responses")
      .in("participant_id", memberIds)
      .eq("cycle_id", pod.cycle_id)
      .order("scheduled_date", { ascending: false });

    const pulseCheckIds = (pulseChecks ?? []).map((pc) => pc.id);
    const nominationCounts: Record<number, number> = {};
    if (pulseCheckIds.length > 0) {
      const { data: nominationRows } = await serviceClient
        .from("nominations")
        .select("pulse_check_id")
        .in("pulse_check_id", pulseCheckIds);
      for (const row of nominationRows ?? []) {
        if (row.pulse_check_id != null) {
          nominationCounts[row.pulse_check_id] =
            (nominationCounts[row.pulse_check_id] ?? 0) + 1;
        }
      }
    }

    const checksByParticipant: Record<
      number,
      { scheduled_date: string; completed_at: string | null; survey_responses: Record<string, unknown> | null; nomination_count: number }[]
    > = {};
    for (const pc of pulseChecks ?? []) {
      (checksByParticipant[pc.participant_id] ??= []).push({
        scheduled_date: pc.scheduled_date,
        completed_at: pc.completed_at,
        survey_responses: pc.survey_responses as Record<string, unknown> | null,
        nomination_count: nominationCounts[pc.id] ?? 0,
      });
    }

    pulseCheckData = members.map((m) => {
      const p = (m.participants as unknown) as Record<string, string> | null;
      return {
        participant_id: m.participant_id,
        name: `${p?.preferred_name || p?.first_name || ""} ${p?.last_name || ""}`.trim(),
        checks: checksByParticipant[m.participant_id] ?? [],
      };
    });
  }

  const podVariant = POD_STATUS_VARIANT[pod.status as PodStatus] ?? "inactive";
  const podName = pod.name || `${podNoun(mode)} ${pod.id}`;
  const pageCtx = await resolvePageContext("pod", pod.id);

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${pod.cycle_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-meta transition-colors duration-150 hover:text-teal-deep"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to cycle
        </Link>
        <h1 className="t-h1 mt-2 text-ink">
          {pod.name || `${podNoun(mode)} ${pod.id}`}
        </h1>
        {mode === "org" && (
          <p className="mt-1 text-sm text-meta">
            An organization workstream &mdash; part of the org cycle.
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-3">
          <StatusBadge variant={podVariant}>{pod.status}</StatusBadge>
          {pageCtx.viewerId != null && (
            <FollowButton
              type="pod"
              id={pod.id}
              initialFollowing={pageCtx.following}
              size="sm"
            />
          )}
        </div>
      </div>

      {ps?.statement_text && (
        <div className="mb-6 rounded-card border border-ink/10 border-l-4 border-l-teal bg-white p-4 shadow-card">
          <h3 className="lbl mb-1">
            Problem statement
          </h3>
          <p className="text-charcoal">{ps.statement_text}</p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="t-h3 mb-3 text-ink">
          Members ({members?.length || 0})
        </h2>
        <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-teal/[0.08]">
              <tr>
                <th className="lbl lbl-teal px-4 py-3">
                  Name
                </th>
                <th className="lbl lbl-teal px-4 py-3">
                  Status
                </th>
                <th className="lbl lbl-teal px-4 py-3">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {(members || []).map((m) => {
                const p = (m.participants as unknown) as Record<string, string> | null;
                return (
                  <tr
                    key={m.participant_id}
                    className="transition-colors duration-150 hover:bg-ink/[0.02]"
                  >
                    <td className="px-4 py-3 text-charcoal">
                      {p?.preferred_name || p?.first_name} {p?.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        variant={m.inactive_at ? "revoked" : "active"}
                      >
                        {m.inactive_at ? "inactive" : "active"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-meta tabular-nums">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {((projects && projects.length > 0) || canCharter) && (
        <div className="mb-8">
          <h2 className="t-h3 mb-3 text-ink">
            Projects
          </h2>
          {projects && projects.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((project) => {
                const variant =
                  POD_STATUS_VARIANT[project.status as PodStatus] ?? "inactive";
                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="rounded-card border border-ink/10 bg-white p-4 shadow-card transition-colors duration-150 ease-out hover:border-ink/20 hover:bg-ink/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold tracking-tight text-ink">
                        {project.name || `Project ${project.id}`}
                      </span>
                      <StatusBadge variant={variant}>
                        {project.status}
                      </StatusBadge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {canCharter && (
            <div className={projects && projects.length > 0 ? "mt-3" : ""}>
              <CharterProjectForm podId={pod.id} />
            </div>
          )}
        </div>
      )}

      <section className="mt-8">
        <PageUpdatesSection
          type="pod"
          id={pod.id}
          name={podName}
          ctx={pageCtx}
        />
      </section>

      {canViewDashboard && (
        <PulseCheckDashboard members={pulseCheckData} />
      )}
    </div>
  );
}
