import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { resolveUserRoles, isAdmin, isModeratorForPod, can } from "@/lib/auth/roles";
import PulseCheckDashboard from "./pulse-check-dashboard";

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
    }[];
  }[] = [];

  if (canViewDashboard && members && members.length > 0) {
    const memberIds = members.map((m) => m.participant_id);

    const { data: pulseChecks } = await serviceClient
      .from("pulse_checks")
      .select("participant_id, scheduled_date, completed_at, survey_responses")
      .in("participant_id", memberIds)
      .eq("cycle_id", pod.cycle_id)
      .order("scheduled_date", { ascending: false });

    const checksByParticipant: Record<
      number,
      { scheduled_date: string; completed_at: string | null; survey_responses: Record<string, unknown> | null }[]
    > = {};
    for (const pc of pulseChecks ?? []) {
      (checksByParticipant[pc.participant_id] ??= []).push({
        scheduled_date: pc.scheduled_date,
        completed_at: pc.completed_at,
        survey_responses: pc.survey_responses as Record<string, unknown> | null,
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

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/cycles/${pod.cycle_id}`}
          className="text-sm text-cloud/60 hover:text-aqua"
        >
          &larr; Back to Cycle
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-white">
          {pod.name || `Pod ${pod.id}`}
        </h1>
        <span
          className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            pod.status === "active"
              ? "bg-teal/20 text-aqua"
              : pod.status === "forming"
                ? "bg-teal/10 text-teal"
                : "bg-white/10 text-cloud/60"
          }`}
        >
          {pod.status}
        </span>
      </div>

      {ps?.statement_text && (
        <div className="mb-6 rounded-md border-l-2 border-l-teal border border-whisper bg-white/[0.02] p-4">
          <h3 className="mb-1 text-sm font-medium text-muted">
            Problem Statement
          </h3>
          <p className="text-white">
            {ps.statement_text}
          </p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-white">
          Members ({members?.length || 0})
        </h2>
        <div className="overflow-hidden rounded-md border border-whisper">
          <table className="w-full text-left text-sm">
            <thead className="bg-teal/[0.08]">
              <tr>
                <th className="px-4 py-2 text-xs font-semibold text-aqua">
                  Name
                </th>
                <th className="px-4 py-2 text-xs font-semibold text-aqua">
                  Status
                </th>
                <th className="px-4 py-2 text-xs font-semibold text-aqua">
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
                    className="bg-white/[0.01]"
                  >
                    <td className="px-4 py-2 text-white">
                      {p?.preferred_name || p?.first_name} {p?.last_name}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          m.inactive_at
                            ? "bg-red/20 text-red-300"
                            : "bg-teal/20 text-aqua"
                        }`}
                      >
                        {m.inactive_at ? "inactive" : "active"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-cloud/60">
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
          <h2 className="mb-3 text-lg font-semibold text-white">
            Projects
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-md border border-whisper bg-white/[0.02] p-4 transition-colors hover:border-teal/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">
                    {project.name || `Project ${project.id}`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      project.status === "active"
                        ? "bg-teal/20 text-aqua"
                        : project.status === "forming"
                          ? "bg-teal/10 text-teal"
                          : "bg-white/10 text-cloud/60"
                    }`}
                  >
                    {project.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {canViewDashboard && (
        <PulseCheckDashboard members={pulseCheckData} />
      )}
    </div>
  );
}
