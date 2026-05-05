import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { resolveUserRoles, isAdmin, isModeratorForPod, can } from "@/lib/auth/roles";
import { StatusBadge } from "@/app/components/ui";
import PulseCheckDashboard from "./pulse-check-dashboard";

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
      "id, name, status, cycle_id, problem_statement_id, problem_statements(statement_text)"
    )
    .eq("id", parseInt(pod_id))
    .single();

  if (!pod) notFound();

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
  const canViewDashboard =
    userRoles &&
    (isAdmin(userRoles) ||
      isModeratorForPod(userRoles, pod.id) ||
      can(userRoles, "pulse_checks:read"));

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

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${pod.cycle_id}`}
          className="inline-flex items-center gap-1.5 text-sm text-cloud/60 transition-colors duration-150 hover:text-aqua focus-visible:outline-none focus-visible:text-aqua"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to cycle
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          {pod.name || `Pod ${pod.id}`}
        </h1>
        <span className="mt-2 inline-block">
          <StatusBadge variant={podVariant}>{pod.status}</StatusBadge>
        </span>
      </div>

      {ps?.statement_text && (
        <div className="mb-6 rounded-md border border-whisper border-l-2 border-l-teal bg-white/[0.02] p-4">
          <h3 className="mb-1 text-xs font-medium uppercase tracking-widest text-cloud/60">
            Problem statement
          </h3>
          <p className="text-cloud">{ps.statement_text}</p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-white">
          Members ({members?.length || 0})
        </h2>
        <div className="overflow-hidden rounded-md border border-whisper">
          <table className="w-full text-left text-sm">
            <thead className="bg-teal/[0.08]">
              <tr>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-aqua">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-aqua">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-aqua">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-whisper">
              {(members || []).map((m) => {
                const p = (m.participants as unknown) as Record<string, string> | null;
                return (
                  <tr
                    key={m.participant_id}
                    className="transition-colors duration-150 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-cloud">
                      {p?.preferred_name || p?.first_name} {p?.last_name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        variant={m.inactive_at ? "revoked" : "active"}
                      >
                        {m.inactive_at ? "inactive" : "active"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-cloud/60 tabular-nums">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {projects && projects.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-white">
            Projects
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => {
              const variant =
                POD_STATUS_VARIANT[project.status as PodStatus] ?? "inactive";
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-md border border-whisper bg-white/[0.02] p-4 transition-colors duration-150 ease-out hover:border-white/[0.12] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold tracking-tight text-white">
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
        </div>
      )}

      {canViewDashboard && (
        <PulseCheckDashboard members={pulseCheckData} />
      )}
    </div>
  );
}
