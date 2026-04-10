import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { resolveUserRoles, isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import PulseCheckDashboard from "../../pods/[pod_id]/pulse-check-dashboard";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const projectId = parseInt(project_id);

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, pod_id, cycle_id, solution_proposal_id")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  // Get pod info for breadcrumb
  const { data: pod } = await supabase
    .from("pods")
    .select("id, name")
    .eq("id", project.pod_id)
    .single();

  // Get project members
  const { data: memberships } = await supabase
    .from("project_memberships")
    .select(
      "participant_id, registered_at, left_at, participants(first_name, last_name, preferred_name)"
    )
    .eq("project_id", projectId)
    .order("registered_at");

  const activeMembers = (memberships ?? []).filter((m) => !m.left_at);

  // Check if viewer is admin or moderator for the parent pod
  const userRoles = user
    ? await resolveUserRoles(serviceClient, user.id)
    : null;
  const canViewDashboard =
    userRoles &&
    (isAdmin(userRoles) || isModeratorForPod(userRoles, project.pod_id));

  // Fetch pulse check data for project members
  let pulseCheckData: {
    participant_id: number;
    name: string;
    checks: {
      scheduled_date: string;
      completed_at: string | null;
      survey_responses: Record<string, unknown> | null;
    }[];
  }[] = [];

  if (canViewDashboard && activeMembers.length > 0) {
    const memberIds = activeMembers.map((m) => m.participant_id);

    const { data: pulseChecks } = await serviceClient
      .from("pulse_checks")
      .select("participant_id, scheduled_date, completed_at, survey_responses")
      .in("participant_id", memberIds)
      .eq("cycle_id", project.cycle_id)
      .order("scheduled_date", { ascending: false });

    const checksByParticipant: Record<
      number,
      {
        scheduled_date: string;
        completed_at: string | null;
        survey_responses: Record<string, unknown> | null;
      }[]
    > = {};
    for (const pc of pulseChecks ?? []) {
      (checksByParticipant[pc.participant_id] ??= []).push({
        scheduled_date: pc.scheduled_date,
        completed_at: pc.completed_at,
        survey_responses: pc.survey_responses as Record<string, unknown> | null,
      });
    }

    pulseCheckData = activeMembers.map((m) => {
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
        <div className="flex items-center gap-2 text-sm text-cloud/60">
          <Link href={`/cycles/${project.cycle_id}`} className="hover:text-aqua">
            Cycle
          </Link>
          <span>/</span>
          <Link href={`/pods/${project.pod_id}`} className="hover:text-aqua">
            {pod?.name || `Pod ${project.pod_id}`}
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">
          {project.name || `Project ${project.id}`}
        </h1>
        <span
          className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
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

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-white">
          Members ({activeMembers.length})
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
                  Registered
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-whisper">
              {(memberships ?? []).map((m) => {
                const p = (m.participants as unknown) as Record<
                  string,
                  string
                > | null;
                return (
                  <tr key={m.participant_id} className="bg-white/[0.01]">
                    <td className="px-4 py-2 text-white">
                      {p?.preferred_name || p?.first_name} {p?.last_name}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          m.left_at
                            ? "bg-red/20 text-red-300"
                            : "bg-teal/20 text-aqua"
                        }`}
                      >
                        {m.left_at ? "left" : "active"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-cloud/60">
                      {new Date(m.registered_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {canViewDashboard && (
        <PulseCheckDashboard members={pulseCheckData} />
      )}
    </div>
  );
}
