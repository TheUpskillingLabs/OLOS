import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { resolveUserRoles, isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { StatusBadge } from "@/app/components/ui";
import ShowcaseHeader from "@/app/components/showcase/showcase-header";
import { getEntityLinks } from "@/lib/showcase/links";
import { isFollowing, getFollowerCount } from "@/lib/follows/queries";
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
    .select(
      "id, name, status, pod_id, cycle_id, solution_proposal_id, tagline, description, logo_url, cover_url, github_repo_url"
    )
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

  const participantId = userRoles?.participantId ?? null;
  const canEditPage =
    !!userRoles && (isAdmin(userRoles) || isModeratorForPod(userRoles, project.pod_id));

  const [links, following, followerCount] = await Promise.all([
    getEntityLinks(serviceClient, "project", project.id),
    participantId
      ? isFollowing(serviceClient, participantId, "project", project.id)
      : Promise.resolve(false),
    getFollowerCount(serviceClient, "project", project.id),
  ]);

  return (
    <div>
      <ShowcaseHeader
        entityType="project"
        entityId={project.id}
        name={project.name || `Project ${project.id}`}
        tagline={project.tagline ?? null}
        status={project.status}
        logoUrl={project.logo_url ?? null}
        coverUrl={project.cover_url ?? null}
        memberCount={activeMembers.length}
        githubRepoUrl={project.github_repo_url ?? null}
        links={links}
        following={following}
        followerCount={followerCount}
        canEdit={canEditPage}
        editHref={`/projects/${project.id}/edit`}
        breadcrumb={
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-sm text-meta"
          >
            <Link
              href={`/cycles/${project.cycle_id}`}
              className="transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
            >
              Cycle
            </Link>
            <span className="text-meta-soft" aria-hidden>
              /
            </span>
            <Link
              href={`/pods/${project.pod_id}`}
              className="transition-colors duration-150 hover:text-teal-deep focus-visible:outline-none focus-visible:text-teal-deep"
            >
              {pod?.name || `Pod ${project.pod_id}`}
            </Link>
          </nav>
        }
      />

      {project.description && (
        <div className="mb-6 rounded-card border border-ink/10 bg-white p-5 shadow-card">
          <h2 className="lbl mb-2">About</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-charcoal">
            {project.description}
          </p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="t-h3 mb-3 text-ink">
          Members ({activeMembers.length})
        </h2>
        <div className="overflow-hidden rounded-card border border-ink/10 bg-white shadow-card">
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
                  Registered
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {(memberships ?? []).map((m) => {
                const p = (m.participants as unknown) as Record<
                  string,
                  string
                > | null;
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
                        variant={m.left_at ? "revoked" : "active"}
                      >
                        {m.left_at ? "left" : "active"}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-meta tabular-nums">
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
