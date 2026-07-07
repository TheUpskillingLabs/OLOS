import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { resolveUserRoles, isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { isProjectDri } from "@/lib/auth/projects";
import { StatusBadge } from "@/app/components/ui";
import { podNoun } from "@/lib/cycle/labels";
import { one } from "@/lib/supabase/embed";
import PulseCheckDashboard from "../../pods/[pod_id]/pulse-check-dashboard";
import FollowButton from "./follow-button";
import ContributorsSection from "./contributors-section";

type ProjectStatus = "active" | "forming" | "closed" | "inactive";

const PROJECT_STATUS_VARIANT: Record<
  ProjectStatus,
  "active" | "forming" | "inactive"
> = {
  active: "active",
  forming: "forming",
  closed: "inactive",
  inactive: "inactive",
};

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
      "id, name, status, pod_id, cycle_id, solution_proposal_id, cycles(mode)"
    )
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  const mode = one(
    project.cycles as { mode: string } | { mode: string }[] | null
  )?.mode;

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

  // Active project_roles (DRI/contributor ladder) with participant names.
  const { data: projectRoleRows } = await serviceClient
    .from("project_roles")
    .select(
      "participant_id, role, created_at, participants(first_name, last_name, preferred_name)"
    )
    .eq("project_id", projectId)
    .is("removed_at", null)
    .order("created_at");

  const contributors = (projectRoleRows ?? []).map((r) => {
    const p = (r.participants as unknown) as Record<string, string> | null;
    return {
      participant_id: r.participant_id,
      name: `${p?.preferred_name || p?.first_name || ""} ${p?.last_name || ""}`.trim(),
      role: r.role as "dri" | "contributor",
      created_at: r.created_at,
    };
  });

  // Viewer's own follow state — self-read RLS covers this via the anon client.
  let following = false;
  if (userRoles?.participantId) {
    const { data: subscription } = await supabase
      .from("project_subscriptions")
      .select("id")
      .eq("project_id", projectId)
      .eq("participant_id", userRoles.participantId)
      .maybeSingle();
    following = !!subscription;
  }

  const { count: followerCount } = await serviceClient
    .from("project_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  // One DRI definition, shared with the POST route (lib/auth/projects).
  const canManageContributors = userRoles
    ? await isProjectDri(serviceClient, userRoles, projectId, project.pod_id)
    : false;

  // Add-contributor options: the cycle's enrollees, unioned with the
  // project's followers (project_subscriptions) — org enrollees are
  // invite-only staff, so followers are how a DRI reaches the ICs the
  // follow feature is meant to recruit (docs/ORG_CYCLES.md §2). Deduped by
  // participant_id; follower-only entries are suffixed so the DRI can tell
  // them apart from enrollees. Only fetched when the viewer can manage.
  let participantOptions: { participant_id: number; name: string }[] = [];
  if (canManageContributors) {
    const [{ data: enrollments }, { data: followerRows }] = await Promise.all([
      serviceClient
        .from("cycle_enrollments")
        .select(
          "participant_id, participants(first_name, last_name, preferred_name)"
        )
        .eq("cycle_id", project.cycle_id),
      serviceClient
        .from("project_subscriptions")
        .select(
          "participant_id, participants(first_name, last_name, preferred_name)"
        )
        .eq("project_id", projectId),
    ]);

    const nameOf = (row: { participants: unknown }) => {
      const p = (row.participants as unknown) as Record<string, string> | null;
      return `${p?.preferred_name || p?.first_name || ""} ${p?.last_name || ""}`.trim();
    };

    const optionsByParticipant = new Map<number, string>();
    for (const e of enrollments ?? []) {
      optionsByParticipant.set(e.participant_id, nameOf(e));
    }
    for (const f of followerRows ?? []) {
      if (optionsByParticipant.has(f.participant_id)) continue;
      optionsByParticipant.set(f.participant_id, `${nameOf(f)} (follower)`);
    }

    participantOptions = [...optionsByParticipant.entries()].map(
      ([participant_id, name]) => ({ participant_id, name })
    );
  }

  const projectVariant =
    PROJECT_STATUS_VARIANT[project.status as ProjectStatus] ?? "inactive";

  return (
    <div>
      <div className="mb-8">
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
            {pod?.name || `${podNoun(mode)} ${project.pod_id}`}
          </Link>
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="t-h1 text-ink">
              {project.name || `Project ${project.id}`}
            </h1>
            <span className="mt-2 inline-block">
              <StatusBadge variant={projectVariant}>{project.status}</StatusBadge>
            </span>
          </div>
          {userRoles?.participantId != null && (
            <FollowButton projectId={project.id} following={following} />
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="t-h3 mb-3 text-ink">
          {mode === "org" ? "Core team" : "Members"} ({activeMembers.length})
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

      <div className="mb-8">
        <ContributorsSection
          projectId={project.id}
          contributors={contributors}
          followerCount={followerCount ?? 0}
          canManage={canManageContributors}
          participantOptions={participantOptions}
        />
      </div>

      {canViewDashboard && (
        <PulseCheckDashboard members={pulseCheckData} />
      )}
    </div>
  );
}
