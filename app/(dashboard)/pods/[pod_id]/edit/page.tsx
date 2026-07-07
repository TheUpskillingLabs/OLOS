import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { resolveUserRoles, isAdmin, isModeratorForPod } from "@/lib/auth/roles";
import { getEntityLinks } from "@/lib/showcase/links";
import ShowcaseEditForm from "@/app/components/showcase/showcase-edit-form";

/**
 * /pods/[pod_id]/edit — curator editor for the pod showcase page. Gated to the
 * pod's Poderator or an admin (non-curators are redirected to the page). Mirrors
 * /profile/edit. The API routes re-check authorization on every write.
 */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "•";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function PodEditPage({
  params,
}: {
  params: Promise<{ pod_id: string }>;
}) {
  const { pod_id } = await params;
  const podId = parseInt(pod_id, 10);
  if (Number.isNaN(podId)) notFound();

  const supabase = await createClient();
  const service = createServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userRoles = await resolveUserRoles(service, user.id);
  const { data: pod } = await service
    .from("pods")
    .select("id, name, tagline, description, directory_visible, logo_url, cover_url")
    .eq("id", podId)
    .maybeSingle();
  if (!pod) notFound();

  if (!isAdmin(userRoles) && !isModeratorForPod(userRoles, pod.id)) {
    redirect(`/pods/${pod.id}`);
  }

  const links = await getEntityLinks(service, "pod", pod.id);
  const name = pod.name || `Pod ${pod.id}`;

  return (
    <ShowcaseEditForm
      entityType="pod"
      entityId={pod.id}
      name={name}
      backHref={`/pods/${pod.id}`}
      initial={{
        tagline: pod.tagline ?? "",
        description: pod.description ?? "",
        directory_visible: !!pod.directory_visible,
        logoUrl: pod.logo_url ?? null,
        coverUrl: pod.cover_url ?? null,
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
