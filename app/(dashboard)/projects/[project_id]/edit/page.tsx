import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { getEntityLinks } from "@/lib/showcase/links";
import ShowcaseEditForm from "@/app/components/showcase/showcase-edit-form";

/**
 * /projects/[project_id]/edit — curator editor for the project showcase page.
 * Gated to the parent pod's Poderator or an admin (non-curators redirect to the
 * page). The API routes re-check authorization on every write.
 */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function ProjectEditPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  const projectId = parseInt(project_id, 10);
  if (Number.isNaN(projectId)) notFound();

  const supabase = await createClient();
  const service = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userRoles = await resolveUserRoles(service, user.id);
  const { data: project } = await service
    .from("projects")
    .select(
      "id, name, pod_id, tagline, description, directory_visible, logo_url, cover_url"
    )
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  if (!isAdmin(userRoles) && !isModeratorForPod(userRoles, project.pod_id)) {
    redirect(`/projects/${project.id}`);
  }

  const links = await getEntityLinks(service, "project", project.id);
  const name = project.name || `Project ${project.id}`;

  return (
    <ShowcaseEditForm
      entityType="project"
      entityId={project.id}
      name={name}
      backHref={`/projects/${project.id}`}
      initial={{
        tagline: project.tagline ?? "",
        description: project.description ?? "",
        directory_visible: !!project.directory_visible,
        logoUrl: project.logo_url ?? null,
        coverUrl: project.cover_url ?? null,
        initials: initialsOf(name),
      }}
      initialLinks={links.map((l) => ({
        platform: l.platform,
        url: l.url,
        label: l.label,
      }))}
    />
  );
}
